"use client";
/* eslint-disable @next/next/no-img-element -- local blob URLs intentionally bypass Next image optimization */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, ImageIcon, Info, Library, LoaderCircle, Minus, Plus, Printer, RotateCcw, Settings2, Upload, X } from "lucide-react";
import {
  A4_HEIGHT_POINTS,
  A4_PAGE,
  A4_WIDTH_POINTS,
  CJNET_NORMAL_EDGE_MARGIN_POINTS,
  ONE_BY_ONE_POINTS,
  PASSPORT_EDGE_MARGIN_POINTS,
  PRESETS,
  TWO_BY_TWO_POINTS,
  arrangeOnPage,
  arrangeMixedShelves,
  createCustomRequest,
  createFixedSquareRequest,
  createMixedSquareRequest,
  createPassportRequest,
  millimetersToPoints,
  maximumSmallCopies,
  smallCopiesBesideBigRows,
  type LayoutRequest,
  type PresetId,
} from "@/lib/layout";
import { cropTransformStyle, DEFAULT_CROP, type CropTransform } from "@/lib/images/crop";
import { useWorkingPhoto } from "@/components/working-photo-context";
import { SavePhotoToLibraryDialog } from "@/components/save-photo-to-library-dialog";
import { useFeedback } from "@/components/feedback-provider";
import { LibraryPhotoPickerDialog } from "@/components/library-photo-picker-dialog";
import { buildPdfDownloadName } from "@/lib/pdf/download-name";
import { getPrintHelperHealth, openNativePrintDialog, pairPrintHelper, PrintHelperPairingError, type PrintHelperHealth } from "@/lib/printing/print-helper";
import { NativePrintDialog } from "@/components/native-print-dialog";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface LoadedPhoto {
  file: File;
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
}

interface Counts { big: number; small: number }

const presetDefaults: Record<PresetId, Counts> = {
  "cjnet-normal": { big: 4, small: 6 },
  "2x2-pair": { big: 2, small: 0 },
  "2x2-only": { big: 8, small: 0 },
  "1x1-only": { big: 0, small: 20 },
  passport: { big: 5, small: 0 },
  custom: { big: 1, small: 0 },
};

export function TemplateFoundation() {
  const workingPhoto = useWorkingPhoto();
  const { confirm, toast } = useFeedback();
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [smallPhoto, setSmallPhoto] = useState<LoadedPhoto | null>(null);
  const [preset, setPreset] = useState<PresetId>("cjnet-normal");
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [counts, setCounts] = useState<Counts>(presetDefaults["cjnet-normal"]);
  const [passport, setPassport] = useState({ width: 35, height: 45 });
  const [custom, setCustom] = useState({ width: 2, height: 2, unit: "in" as "in" | "mm" | "cm", quantity: 4, spacing: 2, margin: 2 });
  const [borders, setBorders] = useState(true);
  const [borderColor, setBorderColor] = useState("#808080");
  const [borderThickness, setBorderThickness] = useState(0.5);
  const [backgroundChoice, setBackgroundChoice] = useState<"transparent" | "white" | "blue" | "custom">("white");
  const [customBackground, setCustomBackground] = useState("#dbeafe");
  const [sameForAll, setSameForAll] = useState(true);
  const [crops, setCrops] = useState<{ big: CropTransform; small: CropTransform }>({ big: DEFAULT_CROP, small: DEFAULT_CROP });
  const [cropTarget, setCropTarget] = useState<"big" | "small" | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"download" | "print" | null>(null);
  const [showPrintGuide, setShowPrintGuide] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [jobName, setJobName] = useState("");
  const [printHelper, setPrintHelper] = useState<PrintHelperHealth>({ available: false, paired: false });
  const [pairingCode, setPairingCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const smallInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => { if (smallPhoto) URL.revokeObjectURL(smallPhoto.url); }, [smallPhoto]);
  useEffect(() => { if (error) toast(error, { tone: "error" }); }, [error, toast]);
  useEffect(() => { if (notice) toast(notice, { tone: "success" }); }, [notice, toast]);
  useEffect(() => {
    let active = true;
    void getPrintHelperHealth().then((health) => {
      if (active) setPrintHelper(health);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const transfer = workingPhoto.photo;
    if (!transfer) return;
    let active = true;
    void loadPhoto(transfer.file).then((loaded) => {
      if (!active) { URL.revokeObjectURL(loaded.url); return; }
      setPhoto(loaded);
      setJobName("");
      setCrops({ big: DEFAULT_CROP, small: DEFAULT_CROP });
      setError(null);
      setNotice(`${transfer.file.name} was loaded from the Customer Library.`);
      workingPhoto.clear();
    }).catch(() => { if (active) setError("The Library photo could not be loaded."); });
    return () => { active = false; };
  }, [workingPhoto]);

  const request = useMemo<LayoutRequest>(() => {
    if (tab === "custom" || preset === "custom") {
      return createCustomRequest({ ...custom, quantity: custom.quantity, spacing: custom.spacing / (custom.unit === "in" ? 25.4 : custom.unit === "cm" ? 10 : 1), margin: custom.margin / (custom.unit === "in" ? 25.4 : custom.unit === "cm" ? 10 : 1) });
    }
    if (preset === "cjnet-normal") return createMixedSquareRequest(counts.big, counts.small);
    if (preset === "1x1-only") return createFixedSquareRequest("1x1", counts.small);
    if (preset === "passport") return createPassportRequest(passport.width, passport.height, counts.big);
    return createFixedSquareRequest("2x2", counts.big);
  }, [counts, custom, passport, preset, tab]);
  const passportMixedBase = useMemo(() => ({
    page: A4_PAGE,
    margins: { top: PASSPORT_EDGE_MARGIN_POINTS, right: PASSPORT_EDGE_MARGIN_POINTS, bottom: PASSPORT_EDGE_MARGIN_POINTS, left: PASSPORT_EDGE_MARGIN_POINTS },
    big: { width: millimetersToPoints(passport.width), height: millimetersToPoints(passport.height) },
    small: { width: ONE_BY_ONE_POINTS, height: ONE_BY_ONE_POINTS },
    bigQuantity: counts.big,
  }), [counts.big, passport.height, passport.width]);
  const normalMixedBase = useMemo(() => ({
    page: A4_PAGE,
    margins: { top: CJNET_NORMAL_EDGE_MARGIN_POINTS, right: CJNET_NORMAL_EDGE_MARGIN_POINTS, bottom: CJNET_NORMAL_EDGE_MARGIN_POINTS, left: CJNET_NORMAL_EDGE_MARGIN_POINTS },
    big: { width: TWO_BY_TWO_POINTS, height: TWO_BY_TWO_POINTS },
    small: { width: ONE_BY_ONE_POINTS, height: ONE_BY_ONE_POINTS },
    bigQuantity: counts.big,
  }), [counts.big]);
  const layout = useMemo(() => {
    if (preset === "passport" && tab === "presets") return arrangeMixedShelves({ ...passportMixedBase, smallQuantity: counts.small });
    if (preset === "cjnet-normal" && tab === "presets") return arrangeMixedShelves({ ...normalMixedBase, smallQuantity: counts.small });
    return arrangeOnPage(request);
  }, [counts.small, normalMixedBase, passportMixedBase, preset, request, tab]);
  const activeMixedBase = preset === "cjnet-normal" ? normalMixedBase : passportMixedBase;
  const gapSmallCapacity = useMemo(() => smallCopiesBesideBigRows(activeMixedBase), [activeMixedBase]);
  const totalSmallCapacity = useMemo(() => maximumSmallCopies(activeMixedBase), [activeMixedBase]);
  const gapCopiesAvailable = Math.max(0, gapSmallCapacity - counts.small);
  const totalCopiesAvailable = Math.max(0, totalSmallCapacity - counts.small);
  const fillOffer = gapCopiesAvailable >= 2
    ? { add: gapCopiesAvailable, target: gapSmallCapacity, fillsGap: true }
    : totalCopiesAvailable >= 2
      ? { add: totalCopiesAvailable, target: totalSmallCapacity, fillsGap: false }
      : null;
  const photoBackground = backgroundChoice === "transparent" ? null : backgroundChoice === "white" ? "#ffffff" : backgroundChoice === "blue" ? "#dbeafe" : customBackground;
  const canOutput = Boolean(photo && layout.fits && layout.placed.length > 0 && !generating);
  const activeDefinition = PRESETS.find((item) => item.id === preset);

  useEffect(() => {
    const handlePrintShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p" && canOutput) {
        event.preventDefault();
        Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Print")?.click();
      }
    };
    window.addEventListener("keydown", handlePrintShortcut);
    return () => window.removeEventListener("keydown", handlePrintShortcut);
  }, [canOutput]);

  useEffect(() => {
    if (!photo) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [photo]);

  async function acceptFile(file: File, target: "primary" | "small" = "primary") {
    setError(null);
    try {
      const loaded = await loadPhoto(file);
      if (target === "primary") {
        setPhoto(loaded);
        setJobName("");
        setCrops({ big: DEFAULT_CROP, small: DEFAULT_CROP });
        setShowSavePrompt(true);
      } else {
        setSmallPhoto(loaded);
        setCrops((current) => ({ ...current, small: DEFAULT_CROP }));
      }
      setNotice(`${file.name} is ready.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be loaded. Try another file.");
    }
  }

  async function acceptLibraryPhoto(file: File, customerName: string) {
    const loaded = await loadPhoto(file);
    setPhoto(loaded);
    setJobName(customerName);
    setCrops({ big: DEFAULT_CROP, small: DEFAULT_CROP });
    setShowSavePrompt(false);
    setError(null);
    setNotice(`${customerName}'s saved photo is ready.`);
  }

  function selectPreset(next: PresetId) {
    setPreset(next);
    setCounts(presetDefaults[next]);
    setTab(next === "custom" ? "custom" : "presets");
  }

  function adjustCount(key: keyof Counts, delta: number) {
    setCounts((current) => ({ ...current, [key]: Math.max(0, Math.min(99, current[key] + delta)) }));
  }

  function getPhotoSheetOptions() {
    if (!photo) throw new Error("Choose a customer photo first.");
    const smallSource = !sameForAll && smallPhoto ? smallPhoto : photo;
    return {
      layout,
      sources: {
        primary: { image: photo.image, crop: crops.big },
        big: { image: photo.image, crop: crops.big },
        small: { image: smallSource.image, crop: sameForAll ? crops.big : crops.small },
      },
      borders,
      borderColor,
      borderThickness,
      backgroundColor: photoBackground,
    };
  }

  async function makePdf() {
    const { generatePhotoSheetPdf } = await import("@/lib/pdf/photo-sheet");
    return generatePhotoSheetPdf(getPhotoSheetOptions());
  }

  async function makeNativePrintSheet() {
    const { generateNativePrintSheet } = await import("@/lib/printing/photo-sheet-raster");
    return generateNativePrintSheet(getPhotoSheetOptions());
  }

  async function downloadPdf() {
    setGenerating("download"); setError(null);
    try {
      const bytes = await makePdf();
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      const filename = buildPdfDownloadName({ jobName, presetName: activeDefinition?.name ?? "Custom" });
      anchor.href = url; anchor.download = filename; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice(`${filename} downloaded.`);
    } catch (cause) { setError(pdfError(cause)); } finally { setGenerating(null); }
  }

  async function printPdf() {
    setGenerating("print"); setError(null);
    try {
      const bytes = await makeNativePrintSheet();
      await openNativePrintDialog(Uint8Array.from(bytes));
      setShowPrintGuide(false);
      setNotice("Windows print window opened. Choose the printer, check its settings, then select Print.");
    } catch (cause) {
      if (cause instanceof PrintHelperPairingError) {
        setPrintHelper((current) => ({ ...current, paired: false }));
        setError(cause.message);
      } else setError(printError(cause));
    } finally { setGenerating(null); }
  }

  async function refreshPrintHelper() {
    setPrintHelper(await getPrintHelperHealth());
  }

  async function pairHelper() {
    setGenerating("print"); setError(null);
    try {
      await pairPrintHelper(pairingCode);
      setPairingCode("");
      await refreshPrintHelper();
      setNotice("This computer is paired with CJNET Print Helper.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The helper could not be paired.");
    } finally { setGenerating(null); }
  }

  async function browserPrintFallback() {
    setShowPrintGuide(false);
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setError("Printing was blocked. Allow pop-ups for this page, then try again."); return; }
    printWindow.document.write("<title>Preparing CJNET print…</title><p style='font:16px sans-serif;padding:24px'>Preparing exact-size A4 PDF…</p>");
    setGenerating("print"); setError(null);
    try {
      const bytes = await makePdf();
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }));
      printWindow.location.href = url;
      window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 1200);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("Browser print dialog opened. Use A4 and Actual Size / 100%.");
    } catch (cause) { printWindow.close(); setError(pdfError(cause)); } finally { setGenerating(null); }
  }

  function reduceToFit() {
    if (tab === "custom") {
      setCustom((current) => ({ ...current, quantity: Math.max(1, layout.placed.length) }));
      return;
    }
    setCounts({
      big: layout.placed.filter((item) => item.sourceKey === "big").length,
      small: layout.placed.filter((item) => item.sourceKey === "small").length,
    });
  }

  function resetSheet() {
    setPhoto(null); setSmallPhoto(null); setJobName(""); setPreset("cjnet-normal"); setTab("presets"); setCounts(presetDefaults["cjnet-normal"]); setPassport({ width: 35, height: 45 }); setCustom({ width: 2, height: 2, unit: "in", quantity: 4, spacing: 2, margin: 2 }); setBorders(true); setBorderColor("#808080"); setBorderThickness(0.5); setBackgroundChoice("white"); setCustomBackground("#dbeafe"); setSameForAll(true); setCrops({ big: DEFAULT_CROP, small: DEFAULT_CROP }); setError(null); setNotice(null); setShowSavePrompt(false); setShowSaveDialog(false); setShowLibraryPicker(false);
  }

  async function requestReset() {
    const approved = await confirm({ title: "Reset this sheet?", body: "The selected photo, crops, quantities, and guide settings will be cleared.", cancelLabel: "Keep this sheet", confirmLabel: "Reset sheet", destructive: true });
    if (approved) resetSheet();
  }

  const cropPhoto = cropTarget === "small" && !sameForAll && smallPhoto ? smallPhoto : photo;
  const cropSize = cropTarget === "small"
    ? { width: ONE_BY_ONE_POINTS, height: ONE_BY_ONE_POINTS, label: "1 × 1 in" }
    : preset === "passport"
      ? { width: millimetersToPoints(passport.width), height: millimetersToPoints(passport.height), label: `${passport.width} × ${passport.height} mm` }
      : tab === "custom"
        ? { width: request.items[0]?.width ?? TWO_BY_TWO_POINTS, height: request.items[0]?.height ?? TWO_BY_TWO_POINTS, label: `${custom.width} × ${custom.height} ${custom.unit}` }
        : { width: TWO_BY_TWO_POINTS, height: TWO_BY_TWO_POINTS, label: "2 × 2 in" };

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      <div className="grid min-h-0 flex-1 xl:grid-cols-[336px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border-soft)] bg-white p-4 xl:max-h-[calc(100vh-128px)] xl:overflow-y-auto xl:border-r xl:border-b-0">
          <SectionLabel number="1" label="Photo" />
          <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void acceptFile(file); event.target.value = ""; }} />
          {photo ? <PhotoSummary photo={photo} onReplace={() => inputRef.current?.click()} onRemove={() => void requestReset()} onSave={() => setShowSaveDialog(true)} /> : <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void acceptFile(file); }} className={`mt-2.5 grid min-h-[158px] w-full place-items-center rounded-[10px] border-[1.5px] border-dashed px-5 py-5 text-center transition-colors ${dragging ? "border-[#e0cf6a] bg-[#fffae6]" : "border-[#d5cdb6] bg-[var(--surface-warm)] hover:border-[#e0cf6a] hover:bg-[#fffae6]"}`}><span><span className="mx-auto grid size-[38px] place-items-center rounded-full bg-[var(--brand-tint)]"><Upload size={19} strokeWidth={1.9} /></span><strong className="mt-3 block text-[13px]">Drag the customer&apos;s photo here</strong><span className="mt-1 block text-[12.5px] text-[var(--ink-2)]">or click to browse this computer</span><span className="measurement mt-2 block text-[11px] text-[var(--ink-3)]">JPG · PNG · WEBP · up to 20 MB</span></span></button>}
          {photo && <label className="mt-2.5 block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Customer name <span className="normal-case font-medium">(optional)</span></span><input value={jobName} maxLength={70} onChange={(event) => setJobName(event.target.value)} placeholder="Leave blank for CJNET" className="h-[38px] w-full rounded-lg border border-[var(--border)] bg-white px-2.5" /><span className="mt-1 block text-[10.5px] leading-4 text-[var(--ink-3)]">Used only in the PDF filename. Date and time are added automatically.</span></label>}
          {photo && showSavePrompt && <div className="mt-2.5 rounded-lg border border-[#eedf8a] bg-[#fffcea] p-3 text-[12px] leading-5"><strong>Photo ready. Save it for reprints?</strong><p className="text-[var(--ink-2)]">Add the original photo to the private Customer Library.</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => setShowSaveDialog(true)} className="h-8 rounded-md bg-[var(--brand)] px-3 font-bold">Save to Library</button><button type="button" onClick={() => setShowSavePrompt(false)} className="h-8 px-2 font-semibold text-[var(--ink-2)]">Not now</button></div></div>}
          <button type="button" onClick={() => setShowLibraryPicker(true)} className="mt-2.5 flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] font-semibold"><Library size={15} strokeWidth={1.9} /> Choose from Customer Library</button>
          <div className="mt-4 grid grid-cols-2 rounded-[9px] bg-[var(--ground)] p-[3px]"><button type="button" onClick={() => setTab("presets")} className={`h-[34px] rounded-[7px] font-semibold ${tab === "presets" ? "bg-white shadow-[0_1px_2px_rgba(23,23,23,.09)]" : "text-[var(--ink-2)]"}`}>Presets</button><button type="button" onClick={() => { setTab("custom"); setPreset("custom"); }} className={`h-[34px] rounded-[7px] font-semibold ${tab === "custom" ? "bg-white shadow-[0_1px_2px_rgba(23,23,23,.09)]" : "text-[var(--ink-2)]"}`}>Custom size</button></div>

          {tab === "presets" ? <PresetControls preset={preset} counts={counts} passport={passport} onPreset={selectPreset} onCount={adjustCount} onPassport={setPassport} onUsual={() => setCounts({ big: 4, small: 6 })} /> : <CustomControls custom={custom} onChange={setCustom} />}
          {(preset === "passport" || preset === "cjnet-normal") && tab === "presets" && layout.fits && fillOffer && <div className="mt-3 rounded-lg border border-[#eedf8a] bg-[#fffcea] p-3 text-[12px] leading-5"><strong>Use the empty paper</strong><p className="text-[var(--ink-2)]">{fillOffer.fillsGap ? `The unfinished ${preset === "passport" ? "passport" : "2×2"} row has room for ${fillOffer.add} more 1×1 copies.` : `The remaining A4 paper holds ${fillOffer.add} more 1×1 copies.`} Sayang naman, fill it up?</p><button type="button" onClick={() => setCounts((current) => ({ ...current, small: fillOffer.target }))} className="mt-2 h-8 rounded-md bg-[var(--brand)] px-3 font-bold">Add {fillOffer.add} × 1×1</button></div>}

          {!layout.fits && <div className="mt-3 rounded-lg border border-[#efc0b2] bg-[#fdf0ec] p-3 text-[12px] leading-5 text-[#8c2410]"><strong className="flex items-center gap-2"><AlertTriangle size={15} /> Photos do not fit on A4</strong><p className="mt-1">{layout.overflow.length} requested {layout.overflow.length === 1 ? "copy" : "copies"} cannot fit. Reduce the quantities before printing.</p><button type="button" onClick={reduceToFit} className="mt-2 font-bold underline">Reduce to {layout.placed.length} copies</button></div>}

          <div className="mt-4"><SectionLabel number="4" label="Crop & guides" /></div>
          <button type="button" disabled={!photo} onClick={() => setCropTarget("big")} className="mt-2.5 flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-[var(--ink)] font-semibold disabled:cursor-not-allowed disabled:opacity-45"><ImageIcon size={15} strokeWidth={1.9} /> Adjust crop & zoom</button>
          <label className="mt-3 flex items-center justify-between gap-3"><span><strong className="block font-semibold">Use same photo for all sizes</strong><span className="text-[11.5px] text-[var(--ink-3)]">Applies the main crop to every size</span></span><input type="checkbox" checked={sameForAll} onChange={(event) => setSameForAll(event.target.checked)} className="size-4 accent-black" /></label>
          {!sameForAll && counts.small > 0 && <div className="mt-2.5 rounded-lg border border-[#eedf8a] bg-[#fffcea] p-3"><input ref={smallInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void acceptFile(file, "small"); event.target.value = ""; }} /><p className="font-bold">1×1 photo and crop</p><p className="mt-1 truncate text-[11.5px] text-[var(--ink-2)]">{smallPhoto?.file.name ?? "Using the main photo until replaced"}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => smallInputRef.current?.click()} className="h-8 rounded-md border border-[var(--border)] bg-white px-2.5 font-semibold">Choose photo</button><button type="button" disabled={!photo} onClick={() => setCropTarget("small")} className="h-8 rounded-md border border-[var(--border)] bg-white px-2.5 font-semibold disabled:opacity-45">Crop 1×1</button></div></div>}
          <div className="mt-3"><label className="font-semibold" htmlFor="photo-background">Photo background</label><select id="photo-background" value={backgroundChoice} onChange={(event) => setBackgroundChoice(event.target.value as typeof backgroundChoice)} className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border)] bg-white px-2"><option value="transparent">Original / transparent</option><option value="white">Pure white</option><option value="blue">Light blue</option><option value="custom">Custom color</option></select>{backgroundChoice === "custom" && <input aria-label="Custom photo background color" type="color" value={customBackground} onChange={(event) => setCustomBackground(event.target.value)} className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-white p-1" />}<p className="mt-1.5 text-[11.5px] leading-4 text-[var(--ink-3)]">Visible through transparent areas. For an opaque photo, remove its background first.</p></div>
          <label className="mt-3 flex items-center justify-between gap-3"><span><strong className="block font-semibold">Cutting borders</strong><span className="text-[11.5px] text-[var(--ink-3)]">Printer-safe shared guides</span></span><input type="checkbox" checked={borders} onChange={(event) => setBorders(event.target.checked)} className="size-4 accent-black" /></label>
          {borders && <><div className="mt-2 grid grid-cols-[1fr_1fr] gap-2"><label><span className="mb-1 block text-[11px] font-bold text-[var(--ink-3)]">Color</span><input type="color" value={borderColor} onChange={(event) => setBorderColor(event.target.value)} className="h-9 w-full rounded-lg border border-[var(--border)] bg-white p-1" /></label><label><span className="mb-1 block text-[11px] font-bold text-[var(--ink-3)]">Thickness</span><select value={borderThickness} onChange={(event) => setBorderThickness(Number(event.target.value))} className="h-9 w-full rounded-lg border border-[var(--border)] bg-white px-2"><option value={0.25}>0.25 pt</option><option value={0.5}>0.5 pt (recommended)</option><option value={0.75}>0.75 pt</option><option value={1}>1 pt</option></select></label></div>{preset === "cjnet-normal" && tab === "presets" && <p className="mt-2 text-[11.5px] leading-4 text-[var(--ink-3)]">CJNET Normal is centered with the maximum 3.4 mm edge allowance while keeping all four 2×2 photos exact size.</p>}{preset === "passport" && tab === "presets" && <p className="mt-2 text-[11.5px] leading-4 text-[var(--ink-3)]">Passport sheets use the same 3.4 mm printer-safe edge allowance and clear shared guides as CJNET Normal, while keeping the configured photo size exact.</p>}</>}
        </aside>

          <Preview layout={layout} photo={photo} smallPhoto={smallPhoto} sameForAll={sameForAll} crops={crops} borders={borders} borderColor={borderColor} borderThickness={borderThickness} backgroundColor={photoBackground} presetName={activeDefinition?.name ?? "Custom"} previewZoom={previewZoom} onZoom={setPreviewZoom} />
      </div>

      <footer className="sticky bottom-0 z-10 flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-t border-[var(--border-soft)] bg-white px-5 py-3"><div className="flex max-w-2xl items-start gap-2 text-[12.5px] leading-5 text-[var(--ink-2)]"><Info size={16} strokeWidth={1.9} className="mt-0.5 shrink-0" /><p>Print on A4 photo paper · set Scale to <mark className="bg-[var(--brand-tint)] px-1 font-bold text-[var(--ink)]">Actual Size (100%)</mark><br /><strong className="text-[var(--warn)]">Huwag piliin ang &apos;Fit to page&apos; — mababawasan ang sukat.</strong></p></div><div className="flex items-center gap-2"><button type="button" disabled={!photo} onClick={() => void requestReset()} className="flex h-10 items-center gap-2 rounded-lg px-3 font-semibold disabled:opacity-45"><RotateCcw size={15} /> Reset</button><button type="button" disabled={!canOutput} onClick={() => void downloadPdf()} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-45">{generating === "download" ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />} {generating === "download" ? "Preparing…" : "Download PDF"}</button><button type="button" disabled={!canOutput} onClick={() => setShowPrintGuide(true)} className="flex h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 text-[15px] font-bold hover:bg-[var(--brand-hover)] active:bg-[var(--brand-pressed)] disabled:cursor-not-allowed disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]"><Printer size={17} /> Print</button></div></footer>

      {cropTarget && cropPhoto && <CropDialog photo={cropPhoto} crop={crops[cropTarget]} size={cropSize} onCancel={() => setCropTarget(null)} onApply={(value) => { const target = cropTarget; setCrops((current) => ({ ...current, [target]: value })); setCropTarget(null); setNotice(`${cropSize.label} crop applied.`); }} />}
      {showPrintGuide && <NativePrintDialog generating={generating === "print"} helper={printHelper} pairingCode={pairingCode} onPairingCode={setPairingCode} onRefresh={() => void refreshPrintHelper()} onPair={() => void pairHelper()} onCancel={() => setShowPrintGuide(false)} onDownload={() => { setShowPrintGuide(false); void downloadPdf(); }} onPrint={() => void printPdf()} onBrowserPrint={() => void browserPrintFallback()} />}
      {showSaveDialog && photo && <SavePhotoToLibraryDialog file={photo.file} onClose={() => setShowSaveDialog(false)} onSaved={(customerName) => { setShowSaveDialog(false); setShowSavePrompt(false); setNotice(`${photo.file.name} was saved privately for ${customerName}.`); }} />}
      {showLibraryPicker && <LibraryPhotoPickerDialog onClose={() => setShowLibraryPicker(false)} onChoose={acceptLibraryPhoto} />}
    </div>
  );
}

function Preview({ layout, photo, smallPhoto, sameForAll, crops, borders, borderColor, borderThickness, backgroundColor, presetName, previewZoom, onZoom }: { layout: ReturnType<typeof arrangeOnPage>; photo: LoadedPhoto | null; smallPhoto: LoadedPhoto | null; sameForAll: boolean; crops: { big: CropTransform; small: CropTransform }; borders: boolean; borderColor: string; borderThickness: number; backgroundColor: string | null; presetName: string; previewZoom: number; onZoom: (value: number) => void }) {
  return <main className="min-w-0 overflow-auto bg-[var(--ground)] p-[18px] xl:p-5"><div className="mx-auto flex max-w-[850px] items-center justify-between gap-4"><div className={`inline-flex items-center gap-2 rounded-lg border px-[11px] py-[7px] ${!photo ? "border-[var(--border-soft)] bg-white" : layout.fits ? "border-[#cbe3c6] bg-[#eef6ec] text-[#255c2f]" : "border-[#efc0b2] bg-[#fdf0ec] text-[#8c2410]"}`}><span className={`size-2 rounded-full ${!photo ? "bg-[#bdb6a5]" : layout.fits ? "bg-[#2f6e3b]" : "bg-[#b5220c]"}`} /><strong>{!photo ? "Waiting for photo" : layout.fits ? "Fits on A4" : "Does not fit"}</strong><span className="text-[var(--ink-2)]">· {layout.placed.length} copies · {borders ? "borders shared" : "no borders"}</span></div><div className="flex h-[30px] items-center rounded-lg border border-[var(--border-soft)] bg-white"><button type="button" onClick={() => onZoom(Math.max(50, previewZoom - 10))} className="grid size-[30px] place-items-center" aria-label="Zoom preview out" title="Zoom preview out"><Minus size={13} /></button><span className="measurement min-w-12 text-center text-[11.5px]">{previewZoom}%</span><button type="button" onClick={() => onZoom(Math.min(150, previewZoom + 10))} className="grid size-[30px] place-items-center" aria-label="Zoom preview in" title="Zoom preview in"><Plus size={13} /></button></div></div><div className="mx-auto mt-5 flex min-h-[640px] max-w-[850px] items-start justify-center overflow-auto p-1"><div className="relative aspect-[210/297] w-full max-w-[448px] origin-top overflow-hidden bg-white shadow-[0_1px_3px_rgba(23,23,23,.07)] ring-1 ring-[#dcd6c6]" style={{ transform: `scale(${previewZoom / 100})` }}>{layout.placed.map((item) => { const isSmall = item.sourceKey === "small"; const source = isSmall && !sameForAll && smallPhoto ? smallPhoto : photo; const crop = isSmall && !sameForAll ? crops.small : crops.big; return <div key={item.id} className="absolute overflow-hidden" style={{ left: `${item.x / A4_WIDTH_POINTS * 100}%`, top: `${item.y / A4_HEIGHT_POINTS * 100}%`, width: `${item.width / A4_WIDTH_POINTS * 100}%`, height: `${item.height / A4_HEIGHT_POINTS * 100}%`, backgroundColor: backgroundColor ?? "transparent", border: borders ? `${Math.max(0.5, borderThickness)}px solid ${borderColor}` : "none" }}>{source ? <img src={source.url} alt="" draggable={false} className="h-full w-full select-none" style={cropTransformStyle(crop)} /> : <span className="measurement grid h-full place-items-center bg-[var(--surface-warm)] text-[10px] font-bold text-[var(--ink-3)]">{item.width === 144 ? "2×2" : item.width === 72 ? "1×1" : "PHOTO"}</span>}</div>; })}{!photo && <div className="pointer-events-none absolute inset-x-0 bottom-9 text-center"><span className="measurement text-[11px] text-[var(--ink-3)]">A4 · 210 × 297 mm</span><p className="mt-1 font-bold text-[var(--ink-2)]">No photo yet — {presetName}</p></div>}</div></div></main>;
}

function PresetControls({ preset, counts, passport, onPreset, onCount, onPassport, onUsual }: { preset: PresetId; counts: Counts; passport: { width: number; height: number }; onPreset: (preset: PresetId) => void; onCount: (key: keyof Counts, delta: number) => void; onPassport: (value: { width: number; height: number }) => void; onUsual: () => void }) {
  return <><div className="mt-4"><SectionLabel number="2" label="Layout preset" /></div><div className="mt-2.5 grid grid-cols-2 gap-2">{PRESETS.map((item) => <button key={item.id} type="button" onClick={() => onPreset(item.id)} className={`relative min-h-[64px] rounded-[9px] border p-2.5 text-left ${preset === item.id ? "border-[var(--ink)] bg-[#fffcea] shadow-[inset_0_0_0_1px_var(--ink)]" : "border-[var(--border-soft)] bg-white hover:bg-[var(--surface-warm)]"}`}><span className="block text-[13px] font-bold">{item.name}{item.id === "cjnet-normal" && <span className="ml-1.5 rounded-full border border-[#eedf8a] bg-[var(--brand-tint)] px-1.5 py-0.5 text-[9px] tracking-[0.04em]">USUAL</span>}</span><span className="mt-1 block text-[11px] leading-4 text-[var(--ink-2)]">{item.description}</span></button>)}</div>{preset === "passport" && <div className="mt-3 grid grid-cols-2 gap-2"><NumberField label="Width (mm)" value={passport.width} min={1} onChange={(width) => onPassport({ ...passport, width })} /><NumberField label="Height (mm)" value={passport.height} min={1} onChange={(height) => onPassport({ ...passport, height })} /></div>}<div className="mt-4"><SectionLabel number="3" label="Copies" /></div><div className="mt-2.5 space-y-2">{preset !== "1x1-only" && <Stepper label={preset === "passport" ? `Passport ${passport.width} × ${passport.height} mm` : "2×2 inch"} value={counts.big} onMinus={() => onCount("big", -1)} onPlus={() => onCount("big", 1)} />}{(preset === "1x1-only" || preset === "cjnet-normal" || preset === "passport") && <Stepper label={preset === "passport" ? "1×1 inch (fills the gaps)" : "1×1 inch"} value={counts.small} onMinus={() => onCount("small", -1)} onPlus={() => onCount("small", 1)} />}</div>{preset === "cjnet-normal" && (counts.big !== 4 || counts.small !== 6) && <button type="button" onClick={onUsual} className="mt-2 text-[12px] font-bold underline">Back to usual package</button>}</>;
}

function CustomControls({ custom, onChange }: { custom: { width: number; height: number; unit: "in" | "mm" | "cm"; quantity: number; spacing: number; margin: number }; onChange: (value: typeof custom) => void }) {
  return <div className="mt-4"><SectionLabel number="2" label="Custom measurements" /><div className="mt-2.5 space-y-3 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-4"><div className="grid grid-cols-3 gap-2"><NumberField label="Width" value={custom.width} min={0.1} step={0.1} onChange={(width) => onChange({ ...custom, width })} /><NumberField label="Height" value={custom.height} min={0.1} step={0.1} onChange={(height) => onChange({ ...custom, height })} /><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Unit</span><select value={custom.unit} onChange={(event) => onChange({ ...custom, unit: event.target.value as typeof custom.unit })} className="h-[38px] w-full rounded-lg border border-[var(--border)] bg-white px-2"><option value="in">in</option><option value="mm">mm</option><option value="cm">cm</option></select></label></div><div className="grid grid-cols-3 gap-2"><NumberField label="Quantity" value={custom.quantity} min={1} step={1} onChange={(quantity) => onChange({ ...custom, quantity: Math.round(quantity) })} /><NumberField label="Spacing mm" value={custom.spacing} min={0} step={0.5} onChange={(spacing) => onChange({ ...custom, spacing })} /><NumberField label="Margin mm" value={custom.margin} min={0} step={0.5} onChange={(margin) => onChange({ ...custom, margin })} /></div></div></div>;
}

function CropDialog({ photo, crop, size, onApply, onCancel }: { photo: LoadedPhoto; crop: CropTransform; size: { width: number; height: number; label: string }; onApply: (crop: CropTransform) => void; onCancel: () => void }) {
  const [value, setValue] = useState(crop);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { const handle = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); if (event.key === "Enter") onApply(value); }; window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, [onApply, onCancel, value]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,23,23,.42)] p-5" role="dialog" aria-modal="true" aria-labelledby="crop-title"><div className="w-full max-w-[900px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(23,23,23,.22)]"><header className="flex h-[54px] items-center gap-3 border-b border-[var(--border-soft)] px-5"><h2 id="crop-title" className="text-[17px] font-bold">Adjust crop</h2><span className="rounded-full border border-[#eedf8a] bg-[var(--brand-tint)] px-2.5 py-1 text-[11px] font-bold">Output frame · {size.label}</span><button type="button" onClick={onCancel} className="ml-auto grid size-8 place-items-center rounded-md hover:bg-[#faf7ef]" aria-label="Close crop dialog" title="Close"><X size={17} /></button></header><div className="grid md:grid-cols-[1fr_288px]"><section className="grid place-items-center bg-[var(--ground)] p-[22px]"><div><p className="mb-3 text-center text-[12.5px] text-[var(--ink-2)]">This is exactly what prints · drag to move</p><div onPointerDown={(event) => { pointer.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!pointer.current) return; const rect = event.currentTarget.getBoundingClientRect(); const dx = event.clientX - pointer.current.x; const dy = event.clientY - pointer.current.y; pointer.current = { x: event.clientX, y: event.clientY }; setValue((current) => ({ ...current, dx: clamp(current.dx + (dx / rect.width) * 100 / (current.zoom / 100), -60, 60), dy: clamp(current.dy + (dy / rect.height) * 100 / (current.zoom / 100), -60, 60) })); }} onPointerUp={() => { pointer.current = null; }} className="relative max-h-[424px] max-w-[384px] touch-none overflow-hidden border border-[var(--cut-guide)] bg-white active:cursor-grabbing" style={{ width: size.width >= size.height ? 384 : Math.round(384 * size.width / size.height), aspectRatio: `${size.width}/${size.height}`, cursor: "grab" }}>{ }<img src={photo.url} alt="Crop preview" draggable={false} className="h-full w-full select-none" style={cropTransformStyle(value)} /><span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[rgba(23,23,23,.78)] px-2 py-1 text-[11px] font-bold text-white">Drag to move · slider to zoom</span></div></div></section><aside className="border-t border-[var(--border-soft)] p-5 md:border-t-0 md:border-l"><label className="block font-bold">Photo fit</label><div className="mt-2 grid grid-cols-2 rounded-[9px] bg-[var(--ground)] p-[3px]"><button type="button" onClick={() => setValue((current) => ({ ...current, fitMode: "cover" }))} className={`h-[34px] rounded-[7px] font-semibold ${value.fitMode === "cover" ? "bg-white shadow-[0_1px_2px_rgba(23,23,23,.09)]" : "text-[var(--ink-2)]"}`}>Fill frame</button><button type="button" onClick={() => setValue((current) => ({ ...current, fitMode: "contain" }))} className={`h-[34px] rounded-[7px] font-semibold ${value.fitMode === "contain" ? "bg-white shadow-[0_1px_2px_rgba(23,23,23,.09)]" : "text-[var(--ink-2)]"}`}>Whole photo</button></div><label className="mt-5 block"><span className="flex items-center justify-between font-bold">Zoom <span className="measurement text-[11.5px]">{value.zoom}%</span></span><input type="range" min={100} max={300} value={value.zoom} onChange={(event) => setValue((current) => ({ ...current, zoom: Number(event.target.value) }))} className="mt-2 w-full accent-black" /></label><button type="button" onClick={() => setValue((current) => ({ ...current, dx: 0, dy: 0 }))} className="mt-5 h-[38px] w-full rounded-lg border border-[var(--border)] font-semibold">Centre the photo</button><button type="button" onClick={() => setValue(DEFAULT_CROP)} className="mt-2 h-[38px] w-full rounded-lg font-semibold hover:bg-[#faf7ef]">Reset crop</button><div className="mt-5 rounded-lg border border-[#f0e3bc] bg-[#fffaed] p-3 text-[12px] leading-5 text-[var(--ink-2)]">The source photo stays unchanged. This crop is applied only when previewing and printing.</div><div className="mt-5 flex gap-2"><button type="button" onClick={onCancel} className="h-11 flex-1 rounded-lg border border-[var(--border)] font-semibold">Cancel</button><button type="button" onClick={() => onApply(value)} autoFocus className="h-11 flex-1 rounded-lg bg-[var(--brand)] font-bold hover:bg-[var(--brand-hover)]">Apply crop</button></div></aside></div></div></div>;
}

export function PrinterSettingsDialog({ generating, onCancel, onDownload, onPrint }: { generating: boolean; onCancel: () => void; onDownload: () => void; onPrint: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,23,23,.42)] p-5" role="dialog" aria-modal="true" aria-labelledby="printer-settings-title"><div className="w-full max-w-[620px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(23,23,23,.22)]"><header className="flex min-h-[58px] items-center gap-3 border-b border-[var(--border-soft)] px-5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)]"><Settings2 size={18} strokeWidth={1.9} /></span><div><h2 id="printer-settings-title" className="text-[17px] font-bold">Epson print settings</h2><p className="text-[11.5px] text-[var(--ink-3)]">Check these before every photo-paper print</p></div><button type="button" onClick={onCancel} className="ml-auto grid size-8 place-items-center rounded-md hover:bg-[#faf7ef]" aria-label="Close print settings"><X size={17} /></button></header><div className="p-5"><div className="grid gap-2 sm:grid-cols-2"><PrintSetting label="Printer" value="EPSON L3210 Series" /><PrintSetting label="Paper size" value="A4 · 210 × 297 mm" /><PrintSetting label="Scale" value="Actual Size · 100%" important /><PrintSetting label="Orientation" value="Portrait" /><PrintSetting label="Paper type" value="Epson Photo Quality Ink Jet" important /><PrintSetting label="Quality / color" value="Standard or High · Color" /></div><div className="mt-4 rounded-lg border border-[#eedf8a] bg-[#fffcea] p-3.5 text-[12.5px] leading-5"><strong className="block">How to reach Epson Printer Properties</strong><ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[var(--ink-2)]"><li>In the browser print screen, choose <b>More settings</b>.</li><li>Select <b>Print using system dialog</b> or press <kbd className="rounded border border-[#d8cfb6] bg-white px-1.5 py-0.5 font-semibold text-[var(--ink)]">Ctrl + Shift + P</kbd>.</li><li>Choose the Epson printer, open <b>Preferences / Properties</b>, then select the paper type and quality above.</li></ol></div><p className="mt-3 text-[11.5px] leading-4 text-[var(--ink-3)]">Browsers are not allowed to change printer-driver quality automatically. For the most reliable driver controls, download the PDF, open it in Adobe Acrobat Reader, and print from there.</p></div><footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-warm)] px-5 py-3"><button type="button" onClick={onCancel} className="h-10 rounded-lg px-3 font-semibold">Cancel</button><button type="button" onClick={onDownload} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 font-semibold"><Download size={15} /> Download for Adobe Reader</button><button type="button" disabled={generating} onClick={onPrint} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-60">{generating ? <LoaderCircle className="animate-spin" size={16} /> : <Printer size={16} />} Open print dialog</button></footer></div></div>;
}

function PrintSetting({ label, value, important = false }: { label: string; value: string; important?: boolean }) {
  return <div className={`rounded-lg border p-3 ${important ? "border-[#eedf8a] bg-[#fffcea]" : "border-[var(--border-soft)] bg-[var(--surface-warm)]"}`}><span className="block text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{label}</span><strong className="mt-1 block text-[12.5px]">{value}</strong></div>;
}

function PhotoSummary({ photo, onReplace, onRemove, onSave }: { photo: LoadedPhoto; onReplace: () => void; onRemove: () => void; onSave: () => void }) { return <div className="mt-2.5 flex items-center gap-2 rounded-[10px] border border-[var(--border-soft)] bg-white p-2.5">{ }<img src={photo.url} alt="Selected customer" className="size-[46px] rounded-[7px] object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-bold">{photo.file.name}</p><p className="measurement mt-1 text-[11px] text-[var(--ink-3)]">{photo.width} × {photo.height} · imported</p></div><button type="button" onClick={onSave} className="grid size-[30px] place-items-center rounded-md border border-[var(--border-soft)]" aria-label="Save photo to Customer Library" title="Save to Library"><Library size={14} /></button><button type="button" onClick={onReplace} className="grid size-[30px] place-items-center rounded-md border border-[var(--border-soft)]" aria-label="Replace photo" title="Replace photo"><RotateCcw size={14} /></button><button type="button" onClick={onRemove} className="grid size-[30px] place-items-center rounded-md border border-[#efc0b2] text-[var(--danger)]" aria-label="Remove photo" title="Remove photo"><X size={15} /></button></div>; }
function SectionLabel({ number, label }: { number: string; label: string }) { return <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]"><span className="text-[var(--ink)]">{number}</span> · {label}</h2>; }
function Stepper({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) { return <div className="grid grid-cols-[1fr_104px] items-center gap-3"><span className="font-semibold">{label}</span><div className="grid h-[38px] grid-cols-[34px_1fr_34px] overflow-hidden rounded-lg border border-[var(--border)]"><button type="button" onClick={onMinus} className="grid place-items-center bg-[#faf7ef]" aria-label={`Decrease ${label}`} title={`Decrease ${label}`}><Minus size={13} /></button><span className="measurement grid place-items-center text-[14px] font-bold">{value}</span><button type="button" onClick={onPlus} className="grid place-items-center bg-[#faf7ef]" aria-label={`Increase ${label}`} title={`Increase ${label}`}><Plus size={13} /></button></div></div>; }
function NumberField({ label, value, min, step = 0.1, onChange }: { label: string; value: number; min: number; step?: number; onChange: (value: number) => void }) { return <label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</span><input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))} className="h-[38px] w-full rounded-lg border border-[var(--border)] bg-white px-2.5" /></label>; }
async function loadPhoto(file: File): Promise<LoadedPhoto> { if (!ALLOWED_TYPES.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image."); if (file.size > MAX_FILE_BYTES) throw new Error("This image is larger than 20 MB. Choose a smaller file."); const url = URL.createObjectURL(file); const image = new Image(); image.src = url; try { await image.decode(); } catch { URL.revokeObjectURL(url); throw new Error("The image could not be opened. Try exporting it again as JPG or PNG."); } return { file, url, image, width: image.naturalWidth, height: image.naturalHeight }; }
function pdfError(cause: unknown) { const detail = cause instanceof Error ? cause.message : "Unknown PDF error."; return `The PDF could not be prepared: ${detail} Nothing was lost—your layout is still here. Try again; if it fails twice, use Print instead.`; }
function printError(cause: unknown) { const detail = cause instanceof Error ? cause.message : "Unknown print preparation error."; return `The print sheet could not be prepared: ${detail} Nothing was lost—your layout is still here.`; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
