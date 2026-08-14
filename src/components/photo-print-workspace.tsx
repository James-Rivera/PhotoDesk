"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs intentionally bypass image optimization */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, ImageIcon, Info, Library, LoaderCircle, Minus, Pencil, Plus, Printer, RotateCcw, Trash2, Upload, X } from "lucide-react";
import {
  A4_HEIGHT_POINTS,
  A4_PAGE,
  A4_WIDTH_POINTS,
  CJNET_NORMAL_EDGE_MARGIN_POINTS,
  PHOTO_PRINT_SIZES,
  arrangePhotoPrints,
  getPhotoPrintSize,
  photoPrintSizeToPoints,
  toPoints,
  type PhotoPrintOrientation,
  type PhotoPrintSizeId,
  type PhysicalUnit,
} from "@/lib/layout";
import { cropTransformStyle, DEFAULT_CROP, type CropTransform } from "@/lib/images/crop";
import { useFeedback } from "@/components/feedback-provider";
import { LibraryPhotoPickerDialog } from "@/components/library-photo-picker-dialog";
import { SavePhotoToLibraryDialog } from "@/components/save-photo-to-library-dialog";
import { NativePrintDialog } from "@/components/native-print-dialog";
import { buildPdfDownloadName } from "@/lib/pdf/download-name";
import { getPrintHelperHealth, openNativePrintDialog, pairPrintHelper, PrintHelperPairingError, type PrintHelperHealth } from "@/lib/printing/print-helper";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface LoadedPhoto {
  file: File;
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  customerName?: string;
  fromLibrary?: boolean;
}

interface PhotoPrintJob {
  id: string;
  photo: LoadedPhoto;
  sizeId: PhotoPrintSizeId;
  orientation: PhotoPrintOrientation;
  custom: { width: number; height: number; unit: PhysicalUnit };
  quantity: number;
  crop: CropTransform;
}

interface DraftState {
  photo: LoadedPhoto;
  sizeId: PhotoPrintSizeId;
  orientation: PhotoPrintOrientation;
  custom: PhotoPrintJob["custom"];
  quantity: number;
  crop: CropTransform;
  editingId: string | null;
}

const DEFAULT_CUSTOM = { width: 4, height: 6, unit: "in" as PhysicalUnit };
const DRAFT_SOURCE_KEY = "draft-photo-preview";

export function PhotoPrintWorkspace({ active }: { active: boolean }) {
  const { confirm, toast } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<PhotoPrintJob[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [borders, setBorders] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [generating, setGenerating] = useState<"download" | "print" | null>(null);
  const [showPrintGuide, setShowPrintGuide] = useState(false);
  const [printHelper, setPrintHelper] = useState<PrintHelperHealth>({ available: false, paired: false });
  const [pairingCode, setPairingCode] = useState("");

  useEffect(() => {
    let mounted = true;
    void getPrintHelperHealth().then((health) => { if (mounted) setPrintHelper(health); });
    return () => { mounted = false; };
  }, []);

  const layout = useMemo(() => arrangePrintJobs(jobs), [jobs]);
  const previewJobs = useMemo(() => {
    if (!draft) return jobs;
    const draftJob: PhotoPrintJob = {
      id: draft.editingId ?? DRAFT_SOURCE_KEY,
      photo: draft.photo,
      sizeId: draft.sizeId,
      orientation: draft.orientation,
      custom: draft.custom,
      quantity: draft.quantity,
      crop: draft.crop,
    };
    return draft.editingId
      ? jobs.map((job) => job.id === draft.editingId ? draftJob : job)
      : [...jobs, draftJob];
  }, [draft, jobs]);
  const previewLayout = useMemo(() => arrangePrintJobs(previewJobs), [previewJobs]);
  const pendingSourceKey = draft?.editingId ?? (draft ? DRAFT_SOURCE_KEY : null);

  const canOutput = jobs.length > 0 && !draft && layout.fits && layout.placed.length > 0 && !generating;

  useEffect(() => {
    const handlePrint = (event: KeyboardEvent) => {
      if (active && canOutput && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setShowPrintGuide(true);
      }
    };
    window.addEventListener("keydown", handlePrint);
    return () => window.removeEventListener("keydown", handlePrint);
  }, [active, canOutput]);

  useEffect(() => {
    if (!jobs.length && !draft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft, jobs.length]);

  async function acceptFile(file: File, customerName?: string, fromLibrary = false) {
    try {
      const photo = await loadPhoto(file, customerName, fromLibrary);
      if (draft && !draft.editingId) URL.revokeObjectURL(draft.photo.url);
      const orientation: PhotoPrintOrientation = photo.width > photo.height ? "landscape" : "portrait";
      setDraft({ photo, sizeId: "4r", orientation, custom: DEFAULT_CUSTOM, quantity: 1, crop: DEFAULT_CROP, editingId: null });
      toast(`${file.name} is ready.`, { tone: "success" });
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "The photo could not be opened.", { tone: "error" });
    }
  }

  function addOrUpdateDraft() {
    if (!draft) return;
    const size = outputSize(draft);
    if (size.width <= 0 || size.height <= 0) {
      toast("Enter a print width and height greater than zero.", { tone: "error" });
      return;
    }
    if (draft.editingId) {
      setJobs((current) => current.map((job) => job.id === draft.editingId ? { ...draft, id: job.id } : job));
      toast("Photo print updated.", { tone: "success" });
    } else {
      setJobs((current) => [...current, { ...draft, id: crypto.randomUUID() }]);
      toast("Photo added to the A4 sheet.", { tone: "success" });
    }
    setDraft(null);
  }

  function editJob(job: PhotoPrintJob) {
    setDraft({ photo: job.photo, sizeId: job.sizeId, orientation: job.orientation, custom: job.custom, quantity: job.quantity, crop: job.crop, editingId: job.id });
  }

  function cancelDraft() {
    if (draft && !draft.editingId) URL.revokeObjectURL(draft.photo.url);
    setDraft(null);
  }

  async function removeJob(job: PhotoPrintJob) {
    const approved = await confirm({ title: "Remove this photo?", body: `${job.photo.file.name} and its copies will be removed from this A4 sheet.`, cancelLabel: "Keep photo", confirmLabel: "Remove photo", destructive: true });
    if (!approved) return;
    if (draft?.editingId === job.id) setDraft(null);
    setJobs((current) => current.filter((item) => item.id !== job.id));
    URL.revokeObjectURL(job.photo.url);
    toast("Photo removed from the sheet.", { tone: "success" });
  }

  async function resetSheet() {
    const approved = await confirm({ title: "Reset this photo sheet?", body: "All added photos, sizes, quantities, and crops will be cleared.", cancelLabel: "Keep this sheet", confirmLabel: "Reset sheet", destructive: true });
    if (!approved) return;
    const urls = new Set(jobs.map((job) => job.photo.url));
    if (draft && !urls.has(draft.photo.url)) urls.add(draft.photo.url);
    urls.forEach((url) => URL.revokeObjectURL(url));
    setJobs([]);
    setDraft(null);
    setBorders(true);
    toast("Photo sheet reset.", { tone: "success" });
  }

  function photoSheetOptions() {
    return {
      layout,
      sources: Object.fromEntries(jobs.map((job) => [job.id, { image: job.photo.image, crop: job.crop }])),
      borders,
      borderColor: "#808080",
      borderThickness: 0.5,
      backgroundColor: "#ffffff",
    };
  }

  async function makePdf() {
    const { generatePhotoSheetPdf } = await import("@/lib/pdf/photo-sheet");
    return generatePhotoSheetPdf(photoSheetOptions());
  }

  async function downloadPdf() {
    setGenerating("download");
    try {
      const bytes = await makePdf();
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      const filename = buildPdfDownloadName({ presetName: "Photo Prints" });
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast(`${filename} downloaded.`, { tone: "success" });
    } catch (cause) {
      toast(outputError(cause), { tone: "error" });
    } finally { setGenerating(null); }
  }

  async function printNative() {
    setGenerating("print");
    try {
      const { generateNativePrintSheet } = await import("@/lib/printing/photo-sheet-raster");
      const bytes = await generateNativePrintSheet(photoSheetOptions());
      await openNativePrintDialog(Uint8Array.from(bytes));
      setShowPrintGuide(false);
      toast("Windows print window opened.", { tone: "success" });
    } catch (cause) {
      if (cause instanceof PrintHelperPairingError) setPrintHelper((current) => ({ ...current, paired: false }));
      toast(outputError(cause), { tone: "error" });
    } finally { setGenerating(null); }
  }

  async function browserPrint() {
    setShowPrintGuide(false);
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast("Printing was blocked. Allow pop-ups, then try again.", { tone: "error" }); return; }
    printWindow.document.write("<title>Preparing CJNET print…</title><p style='font:16px sans-serif;padding:24px'>Preparing exact-size A4 PDF…</p>");
    setGenerating("print");
    try {
      const bytes = await makePdf();
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }));
      printWindow.location.href = url;
      window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 1200);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast("Browser print opened. Use A4 and Actual Size / 100%.", { tone: "success" });
    } catch (cause) {
      printWindow.close();
      toast(outputError(cause), { tone: "error" });
    } finally { setGenerating(null); }
  }

  async function pairHelper() {
    setGenerating("print");
    try {
      await pairPrintHelper(pairingCode);
      setPairingCode("");
      setPrintHelper(await getPrintHelperHealth());
      toast("This computer is paired with CJNET Print Helper.", { tone: "success" });
    } catch (cause) {
      toast(outputError(cause), { tone: "error" });
    } finally { setGenerating(null); }
  }

  return <div className="flex min-h-[calc(100vh-108px)] flex-col xl:h-full xl:min-h-0 xl:overflow-hidden">
    <div className="grid min-h-0 flex-1 xl:overflow-hidden xl:grid-cols-[336px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--border-soft)] bg-white p-4 xl:min-h-0 xl:overflow-y-auto xl:border-r xl:border-b-0">
        <SectionLabel number="1" label="Add a photo" />
        <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void acceptFile(file); event.target.value = ""; }} />
        {!draft ? <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void acceptFile(file); }} className={`mt-2.5 grid min-h-[132px] w-full place-items-center rounded-[10px] border-[1.5px] border-dashed p-4 text-center ${dragging ? "border-[#e0cf6a] bg-[#fffae6]" : "border-[#d5cdb6] bg-[var(--surface-warm)]"}`}><span><span className="mx-auto grid size-9 place-items-center rounded-full bg-[var(--brand-tint)]"><Upload size={18} /></span><strong className="mt-2.5 block">Add a photo</strong><span className="mt-1 block text-[11.5px] text-[var(--ink-3)]">JPG, PNG, or WebP · up to 20 MB</span></span></button> : <DraftEditor draft={draft} previewFits={previewLayout.fits} previewOverflow={previewLayout.overflow.length} onDraft={setDraft} onCrop={() => setShowCrop(true)} onChoose={() => inputRef.current?.click()} onSave={() => setShowSaveDialog(true)} onApply={addOrUpdateDraft} onCancel={cancelDraft} />}
        {!draft && <button type="button" onClick={() => setShowLibraryPicker(true)} className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] font-semibold"><Library size={15} /> Choose from Customer Library</button>}

        <div className="mt-5"><SectionLabel number="2" label="Photos on this sheet" /></div>
        {jobs.length ? <div className="mt-2.5 space-y-2">{jobs.map((job) => <JobCard key={job.id} job={job} overflow={layout.overflow.some((item) => item.sourceKey === job.id)} onEdit={() => editJob(job)} onRemove={() => void removeJob(job)} />)}</div> : <div className="mt-2.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-warm)] p-4 text-center text-[12px] text-[var(--ink-3)]">No photos on the sheet yet.</div>}

        <label className="mt-4 flex items-center justify-between gap-3"><span><strong className="block">Cutting borders</strong><span className="text-[11px] text-[var(--ink-3)]">0.5 pt shared guides</span></span><input type="checkbox" checked={borders} onChange={(event) => setBorders(event.target.checked)} className="size-4 accent-black" /></label>
        {!layout.fits && <div className="mt-3 rounded-lg border border-[#efc0b2] bg-[#fdf0ec] p-3 text-[12px] leading-5 text-[#8c2410]"><strong className="flex items-center gap-2"><AlertTriangle size={15} /> {layout.overflow.length} {layout.overflow.length === 1 ? "copy does" : "copies do"} not fit</strong><p className="mt-1">Edit a marked photo and reduce its copies. Nothing will be shrunk or omitted.</p></div>}
      </aside>

      <PrintPreview layout={previewLayout} jobs={previewJobs} pendingSourceKey={pendingSourceKey} borders={borders} zoom={previewZoom} onZoom={setPreviewZoom} />
    </div>

    <footer className="sticky bottom-0 z-10 flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-t border-[var(--border-soft)] bg-white px-5 py-3 xl:static"><div className="flex max-w-2xl items-start gap-2 text-[12.5px] leading-5 text-[var(--ink-2)]"><Info size={16} className="mt-0.5 shrink-0" /><p>Print on A4 photo paper · set Scale to <mark className="bg-[var(--brand-tint)] px-1 font-bold text-[var(--ink)]">Actual Size (100%)</mark><br /><strong className="text-[var(--warn)]">PhotoDesk keeps every selected size exact.</strong></p></div><div className="flex items-center gap-2"><button type="button" disabled={!jobs.length && !draft} onClick={() => void resetSheet()} className="flex h-10 items-center gap-2 rounded-lg px-3 font-semibold disabled:opacity-45"><RotateCcw size={15} /> Reset</button><button type="button" disabled={!canOutput} onClick={() => void downloadPdf()} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold disabled:opacity-45">{generating === "download" ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />} Download PDF</button><button type="button" disabled={!canOutput} onClick={() => setShowPrintGuide(true)} className="flex h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 text-[15px] font-bold disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]"><Printer size={17} /> Print</button></div></footer>

    {showCrop && draft && <PhotoCropDialog draft={draft} onCancel={() => setShowCrop(false)} onApply={(crop) => { setDraft({ ...draft, crop }); setShowCrop(false); toast("Crop applied.", { tone: "success" }); }} />}
    {showLibraryPicker && <LibraryPhotoPickerDialog onClose={() => setShowLibraryPicker(false)} onChoose={async (file, customerName) => { setShowLibraryPicker(false); await acceptFile(file, customerName, true); }} />}
    {showSaveDialog && draft && <SavePhotoToLibraryDialog file={draft.photo.file} onClose={() => setShowSaveDialog(false)} onSaved={(customerName) => { setShowSaveDialog(false); setDraft({ ...draft, photo: { ...draft.photo, customerName } }); toast(`Photo saved privately for ${customerName}.`, { tone: "success" }); }} />}
    {showPrintGuide && <NativePrintDialog generating={generating === "print"} helper={printHelper} pairingCode={pairingCode} onPairingCode={setPairingCode} onRefresh={() => void getPrintHelperHealth().then(setPrintHelper)} onPair={() => void pairHelper()} onCancel={() => setShowPrintGuide(false)} onDownload={() => { setShowPrintGuide(false); void downloadPdf(); }} onPrint={() => void printNative()} onBrowserPrint={() => void browserPrint()} />}
  </div>;
}

function DraftEditor({ draft, previewFits, previewOverflow, onDraft, onCrop, onChoose, onSave, onApply, onCancel }: { draft: DraftState; previewFits: boolean; previewOverflow: number; onDraft: (draft: DraftState) => void; onCrop: () => void; onChoose: () => void; onSave: () => void; onApply: () => void; onCancel: () => void }) {
  const size = outputSize(draft);
  return <div className="mt-2.5 rounded-[10px] border border-[#d5c56f] bg-[#fffdf4] p-3">
    <div className="flex items-center gap-2.5"><img src={draft.photo.url} alt="Selected photo" className="size-12 rounded-[7px] object-cover" /><div className="min-w-0 flex-1"><strong className="block truncate">{draft.photo.customerName || draft.photo.file.name}</strong><span className="text-[10.5px] text-[var(--ink-3)]">{draft.photo.width} × {draft.photo.height} px</span></div>{!draft.editingId && <button type="button" onClick={onChoose} className="grid size-8 place-items-center rounded-md border border-[var(--border)] bg-white" title="Choose another photo"><Upload size={14} /></button>}</div>
    <div className="mt-3"><SectionLabel number="2" label="Choose print size" /></div>
    <div className="mt-2 grid grid-cols-2 gap-2">{[...PHOTO_PRINT_SIZES, { id: "custom" as const, label: "Custom", note: "in, mm, or cm" }].map((definition) => <button type="button" key={definition.id} onClick={() => onDraft({ ...draft, sizeId: definition.id })} className={`min-h-[54px] rounded-lg border p-2 text-left ${draft.sizeId === definition.id ? "border-[var(--ink)] bg-white shadow-[inset_0_0_0_1px_var(--ink)]" : "border-[var(--border-soft)] bg-white"}`}><strong className="block">{definition.label}</strong><span className="text-[10.5px] text-[var(--ink-3)]">{definition.note}</span></button>)}</div>
    {draft.sizeId === "custom" ? <div className="mt-2 grid grid-cols-[1fr_1fr_82px] gap-2"><NumberInput label="Width" value={draft.custom.width} onChange={(width) => onDraft({ ...draft, custom: { ...draft.custom, width } })} /><NumberInput label="Height" value={draft.custom.height} onChange={(height) => onDraft({ ...draft, custom: { ...draft.custom, height } })} /><label><span className="mb-1 block text-[10px] font-bold text-[var(--ink-3)]">Unit</span><select value={draft.custom.unit} onChange={(event) => onDraft({ ...draft, custom: { ...draft.custom, unit: event.target.value as PhysicalUnit } })} className="h-9 w-full rounded-lg border border-[var(--border)] bg-white px-2"><option value="in">in</option><option value="mm">mm</option><option value="cm">cm</option></select></label></div> : <div className="mt-2 grid grid-cols-2 rounded-[9px] bg-[var(--ground)] p-[3px]"><button type="button" onClick={() => onDraft({ ...draft, orientation: "portrait" })} className={`h-9 rounded-[7px] font-semibold ${draft.orientation === "portrait" ? "bg-white shadow-sm" : "text-[var(--ink-2)]"}`}>Portrait</button><button type="button" onClick={() => onDraft({ ...draft, orientation: "landscape" })} className={`h-9 rounded-[7px] font-semibold ${draft.orientation === "landscape" ? "bg-white shadow-sm" : "text-[var(--ink-2)]"}`}>Landscape</button></div>}
    <div className="mt-3 flex items-center justify-between"><span><strong>Copies</strong><span className="ml-2 text-[11px] text-[var(--ink-3)]">{formatPoints(size.width)} × {formatPoints(size.height)}</span></span><div className="grid h-9 grid-cols-[32px_38px_32px] overflow-hidden rounded-lg border border-[var(--border)] bg-white"><button type="button" onClick={() => onDraft({ ...draft, quantity: Math.max(1, draft.quantity - 1) })} className="grid place-items-center"><Minus size={13} /></button><strong className="grid place-items-center">{draft.quantity}</strong><button type="button" onClick={() => onDraft({ ...draft, quantity: Math.min(20, draft.quantity + 1) })} className="grid place-items-center"><Plus size={13} /></button></div></div>
    {isLowResolution(draft) && <p className="mt-2 flex items-start gap-1.5 rounded-md bg-[#fff4dc] p-2 text-[11px] leading-4 text-[#7a4b00]"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> This photo may look soft at this print size. Check the preview before printing.</p>}
    <div className={`mt-2 rounded-md border p-2 text-[11px] leading-4 ${previewFits ? "border-[#eedf8a] bg-[#fffcea] text-[var(--ink-2)]" : "border-[#efc0b2] bg-[#fdf0ec] text-[#8c2410]"}`}>{previewFits ? <><strong className="text-[var(--ink)]">Live A4 preview</strong><span> · The yellow dashed photo is not added yet.</span></> : <><strong>{previewOverflow} {previewOverflow === 1 ? "print does" : "prints do"} not fit on A4.</strong><span> Reduce the copies or choose a smaller size.</span></>}</div>
    <button type="button" onClick={onCrop} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--ink)] bg-white font-semibold"><ImageIcon size={14} /> Adjust crop</button>
    {!draft.photo.fromLibrary && <button type="button" onClick={onSave} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white font-semibold"><Library size={14} /> Save photo to Library</button>}
    <div className="mt-3 flex gap-2"><button type="button" onClick={onCancel} className="h-10 flex-1 rounded-lg font-semibold">Cancel</button><button type="button" disabled={!previewFits} onClick={onApply} className="flex h-10 flex-[1.7] items-center justify-center gap-2 rounded-lg bg-[var(--brand)] font-bold disabled:cursor-not-allowed disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]"><Check size={15} /> {draft.editingId ? "Update A4 sheet" : "Add to A4 sheet"}</button></div>
  </div>;
}

function JobCard({ job, overflow, onEdit, onRemove }: { job: PhotoPrintJob; overflow: boolean; onEdit: () => void; onRemove: () => void }) {
  return <div className={`flex items-center gap-2 rounded-lg border p-2 ${overflow ? "border-[#efc0b2] bg-[#fdf0ec]" : "border-[var(--border-soft)] bg-white"}`}><img src={job.photo.url} alt="" className="size-11 rounded-md object-cover" /><div className="min-w-0 flex-1"><strong className="block truncate">{job.photo.customerName || job.photo.file.name}</strong><span className="text-[10.5px] text-[var(--ink-3)]">{sizeName(job)} · {job.quantity} {job.quantity === 1 ? "copy" : "copies"}</span>{overflow && <span className="block text-[10.5px] font-bold text-[var(--danger)]">Some copies do not fit</span>}</div><button type="button" onClick={onEdit} className="grid size-8 place-items-center rounded-md border border-[var(--border)]" title="Edit photo print"><Pencil size={13} /></button><button type="button" onClick={onRemove} className="grid size-8 place-items-center rounded-md border border-[#efc0b2] text-[var(--danger)]" title="Remove photo"><Trash2 size={13} /></button></div>;
}

function PrintPreview({ layout, jobs, pendingSourceKey, borders, zoom, onZoom }: { layout: ReturnType<typeof arrangePhotoPrints>; jobs: PhotoPrintJob[]; pendingSourceKey: string | null; borders: boolean; zoom: number; onZoom: (zoom: number) => void }) {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const pendingJob = pendingSourceKey ? byId.get(pendingSourceKey) : null;
  return <main className="min-w-0 overflow-auto bg-[var(--ground)] p-[18px] xl:min-h-0 xl:p-5"><div className="mx-auto flex max-w-[850px] items-center justify-between gap-4"><div className={`inline-flex items-center gap-2 rounded-lg border px-[11px] py-[7px] ${!jobs.length ? "border-[var(--border-soft)] bg-white" : !layout.fits ? "border-[#efc0b2] bg-[#fdf0ec] text-[#8c2410]" : pendingJob ? "border-[#eedf8a] bg-[#fffcea] text-[#6b5b20]" : "border-[#cbe3c6] bg-[#eef6ec] text-[#255c2f]"}`}><span className={`size-2 rounded-full ${!jobs.length ? "bg-[#bdb6a5]" : !layout.fits ? "bg-[#b5220c]" : pendingJob ? "bg-[#c5a900]" : "bg-[#2f6e3b]"}`} /><strong>{!jobs.length ? "Waiting for photos" : !layout.fits ? "This selection does not fit" : pendingJob ? `Previewing ${sizeName(pendingJob)}` : "Everything fits on A4"}</strong><span className="text-[var(--ink-2)]">{pendingJob ? `· not added yet · ${layout.placed.length} ${layout.placed.length === 1 ? "print" : "prints"} on A4` : `· ${jobs.length} ${jobs.length === 1 ? "photo item" : "photo items"} · ${layout.placed.length} ${layout.placed.length === 1 ? "print" : "prints"}`}</span></div><div className="flex h-[30px] items-center rounded-lg border border-[var(--border-soft)] bg-white"><button type="button" onClick={() => onZoom(Math.max(50, zoom - 10))} className="grid size-[30px] place-items-center"><Minus size={13} /></button><span className="measurement min-w-12 text-center text-[11.5px]">{zoom}%</span><button type="button" onClick={() => onZoom(Math.min(150, zoom + 10))} className="grid size-[30px] place-items-center"><Plus size={13} /></button></div></div><div className="mx-auto mt-5 flex min-h-[640px] max-w-[850px] items-start justify-center overflow-auto p-1"><div className="relative aspect-[210/297] w-full max-w-[448px] origin-top overflow-hidden bg-white shadow-[0_1px_3px_rgba(23,23,23,.07)] ring-1 ring-[#dcd6c6]" style={{ transform: `scale(${zoom / 100})` }}>{layout.placed.map((item) => { const job = byId.get(item.sourceKey); const pending = item.sourceKey === pendingSourceKey; return <div key={item.id} className="absolute overflow-hidden bg-white" style={{ left: `${item.x / A4_WIDTH_POINTS * 100}%`, top: `${item.y / A4_HEIGHT_POINTS * 100}%`, width: `${item.width / A4_WIDTH_POINTS * 100}%`, height: `${item.height / A4_HEIGHT_POINTS * 100}%`, border: pending ? "2px dashed #c5a900" : borders ? "0.5px solid #808080" : "none", boxShadow: pending ? "inset 0 0 0 1px rgba(255,255,255,.8)" : "none" }}>{job && <img src={job.photo.url} alt="" draggable={false} className={`h-full w-full select-none ${pending ? "opacity-85" : ""}`} style={cropTransformStyle(job.crop)} />}</div>; })}{!jobs.length && <div className="absolute inset-x-0 bottom-9 text-center"><span className="measurement text-[11px] text-[var(--ink-3)]">A4 · 210 × 297 mm</span><p className="mt-1 font-bold text-[var(--ink-2)]">Add photos to build this sheet</p></div>}</div></div></main>;
}

function PhotoCropDialog({ draft, onApply, onCancel }: { draft: DraftState; onApply: (crop: CropTransform) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState(draft.crop);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const size = outputSize(draft);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,23,23,.42)] p-5" role="dialog" aria-modal="true"><div className="w-full max-w-[820px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(23,23,23,.22)]"><header className="flex h-14 items-center border-b border-[var(--border-soft)] px-5"><div><h2 className="text-[17px] font-bold">Adjust photo crop</h2><p className="text-[11px] text-[var(--ink-3)]">Output frame · {sizeName(draft)}</p></div><button type="button" onClick={onCancel} className="ml-auto grid size-8 place-items-center"><X size={17} /></button></header><div className="grid md:grid-cols-[1fr_270px]"><section className="grid place-items-center bg-[var(--ground)] p-6"><div onPointerDown={(event) => { pointer.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!pointer.current) return; const rect = event.currentTarget.getBoundingClientRect(); const dx = event.clientX - pointer.current.x; const dy = event.clientY - pointer.current.y; pointer.current = { x: event.clientX, y: event.clientY }; setCrop((current) => ({ ...current, dx: clamp(current.dx + dx / rect.width * 100 / (current.zoom / 100), -60, 60), dy: clamp(current.dy + dy / rect.height * 100 / (current.zoom / 100), -60, 60) })); }} onPointerUp={() => { pointer.current = null; }} className="relative max-h-[430px] w-full max-w-[430px] touch-none overflow-hidden border border-[var(--cut-guide)] bg-white" style={{ aspectRatio: `${size.width}/${size.height}`, cursor: "grab" }}><img src={draft.photo.url} alt="Crop preview" draggable={false} className="h-full w-full select-none" style={cropTransformStyle(crop)} /></div></section><aside className="border-t border-[var(--border-soft)] p-5 md:border-l md:border-t-0"><strong>Photo fit</strong><div className="mt-2 grid grid-cols-2 rounded-[9px] bg-[var(--ground)] p-[3px]"><button type="button" onClick={() => setCrop({ ...crop, fitMode: "cover" })} className={`h-9 rounded-[7px] ${crop.fitMode === "cover" ? "bg-white font-bold shadow-sm" : "text-[var(--ink-2)]"}`}>Fill frame</button><button type="button" onClick={() => setCrop({ ...crop, fitMode: "contain" })} className={`h-9 rounded-[7px] ${crop.fitMode === "contain" ? "bg-white font-bold shadow-sm" : "text-[var(--ink-2)]"}`}>Whole photo</button></div><label className="mt-5 block"><span className="flex justify-between font-bold">Zoom <span>{crop.zoom}%</span></span><input type="range" min="100" max="300" value={crop.zoom} onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })} className="mt-2 w-full accent-black" /></label><button type="button" onClick={() => setCrop({ ...crop, dx: 0, dy: 0 })} className="mt-4 h-9 w-full rounded-lg border border-[var(--border)] font-semibold">Centre photo</button><div className="mt-6 flex gap-2"><button type="button" onClick={onCancel} className="h-10 flex-1 rounded-lg border border-[var(--border)] font-semibold">Cancel</button><button type="button" onClick={() => onApply(crop)} className="h-10 flex-1 rounded-lg bg-[var(--brand)] font-bold">Apply crop</button></div></aside></div></div></div>;
}

function SectionLabel({ number, label }: { number: string; label: string }) { return <p className="text-[10.5px] font-bold uppercase tracking-[0.055em] text-[var(--ink-3)]"><span className="text-[var(--ink)]">{number}</span> · {label}</p>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label><span className="mb-1 block text-[10px] font-bold text-[var(--ink-3)]">{label}</span><input type="number" min="0.1" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-full rounded-lg border border-[var(--border)] bg-white px-2" /></label>; }

function arrangePrintJobs(jobs: PhotoPrintJob[]) {
  return arrangePhotoPrints({
    page: A4_PAGE,
    margins: { top: CJNET_NORMAL_EDGE_MARGIN_POINTS, right: CJNET_NORMAL_EDGE_MARGIN_POINTS, bottom: CJNET_NORMAL_EDGE_MARGIN_POINTS, left: CJNET_NORMAL_EDGE_MARGIN_POINTS },
    horizontalSpacing: 0,
    verticalSpacing: 0,
    items: jobs.flatMap((job) => {
      const size = outputSize(job);
      return Array.from({ length: job.quantity }, (_, index) => ({
        id: `${job.id}-${index}`,
        sourceKey: job.id,
        width: size.width,
        height: size.height,
      }));
    }),
  });
}

function outputSize(value: Pick<PhotoPrintJob, "sizeId" | "orientation" | "custom">) {
  if (value.sizeId === "custom") return { width: toPoints(value.custom.width, value.custom.unit), height: toPoints(value.custom.height, value.custom.unit) };
  return photoPrintSizeToPoints(value.sizeId, value.orientation);
}

function sizeName(value: Pick<PhotoPrintJob, "sizeId" | "orientation" | "custom">) {
  if (value.sizeId === "custom") return `${value.custom.width} × ${value.custom.height} ${value.custom.unit}`;
  return `${getPhotoPrintSize(value.sizeId).label} · ${value.orientation}`;
}

function formatPoints(points: number) { return `${Number((points / 72).toFixed(2))} in`; }
function isLowResolution(draft: DraftState) { const size = outputSize(draft); return draft.photo.width < size.width / 72 * 300 || draft.photo.height < size.height / 72 * 300; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function outputError(cause: unknown) { return cause instanceof Error ? cause.message : "PhotoDesk could not prepare this print sheet."; }

async function loadPhoto(file: File, customerName?: string, fromLibrary = false): Promise<LoadedPhoto> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > MAX_FILE_BYTES) throw new Error("This image is larger than 20 MB. Choose a smaller file.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try { await image.decode(); } catch { URL.revokeObjectURL(url); throw new Error("The image could not be opened. Try exporting it again as JPG or PNG."); }
  return { file, url, image, width: image.naturalWidth, height: image.naturalHeight, customerName, fromLibrary };
}
