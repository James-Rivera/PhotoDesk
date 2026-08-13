"use client";
/* eslint-disable @next/next/no-img-element -- short-lived private Supabase signed URLs */

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, LoaderCircle, Search, X } from "lucide-react";
import { listLibraryPhotoChoices, type LibraryPhotoChoice } from "@/lib/library/client";
import { useFeedback } from "./feedback-provider";

export function LibraryPhotoPickerDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (file: File, customerName: string) => Promise<void> | void }) {
  const { toast } = useFeedback();
  const [photos, setPhotos] = useState<LibraryPhotoChoice[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [choosingId, setChoosingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listLibraryPhotoChoices().then((items) => { if (active) setPhotos(items); }).catch((cause) => {
      if (active) toast(cause instanceof Error ? cause.message : "Could not load the Customer Library.", { tone: "error" });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [toast]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return photos;
    return photos.filter((photo) => `${photo.customerName} ${photo.filename}`.toLowerCase().includes(query));
  }, [photos, search]);

  async function choose(photo: LibraryPhotoChoice) {
    if (!photo.signedUrl) { toast("This private photo preview is unavailable. Close the picker and try again.", { tone: "error" }); return; }
    setChoosingId(photo.id);
    try {
      const response = await fetch(photo.signedUrl);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      await onChoose(new File([blob], photo.filename, { type: photo.mimeType }), photo.customerName);
      onClose();
    } catch {
      toast("Could not load that private photo. Check the connection and try again.", { tone: "error" });
      setChoosingId(null);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,23,23,.44)] p-5" role="dialog" aria-modal="true" aria-labelledby="library-picker-title">
    <div className="flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-[920px] flex-col overflow-hidden rounded-xl border border-[#dfc846] bg-white shadow-[0_20px_52px_rgba(23,23,23,.24)]">
      <header className="flex min-h-[62px] items-center gap-3 border-b border-[#eadf9f] bg-[linear-gradient(120deg,#fffdf4_0%,#fbf3c2_100%)] px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white"><ImageIcon size={17} /></span>
        <div><h2 id="library-picker-title" className="text-[17px] font-bold">Choose a customer photo</h2><p className="text-[11.5px] text-[var(--ink-2)]">Select once to load it directly into this template.</p></div>
        <button type="button" disabled={Boolean(choosingId)} onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-md hover:bg-white/70" aria-label="Close Customer Library"><X size={17} /></button>
      </header>

      <div className="border-b border-[var(--border-soft)] p-4">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" size={15} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer name or filename..." className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3" /></label>
      </div>

      <div className="min-h-[320px] flex-1 overflow-y-auto bg-[var(--surface-warm)] p-4 sm:p-5">
        {loading ? <div className="grid min-h-[320px] place-items-center text-[var(--ink-2)]"><div className="text-center"><LoaderCircle className="mx-auto animate-spin" size={24} /><p className="mt-3 font-semibold">Loading private photos…</p></div></div>
          : filtered.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filtered.map((photo) => <button type="button" key={photo.id} disabled={Boolean(choosingId) || !photo.signedUrl} onClick={() => void choose(photo)} className="group overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#d5c56f] hover:shadow-[0_5px_16px_rgba(23,23,23,.08)] disabled:opacity-55"><span className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-[var(--ground)]">{photo.signedUrl ? <img src={photo.signedUrl} alt={`${photo.customerName} saved photo`} className="h-full w-full object-cover" /> : <ImageIcon className="text-[var(--ink-3)]" size={24} />}{choosingId === photo.id && <span className="absolute inset-0 grid place-items-center bg-white/75"><LoaderCircle className="animate-spin" size={23} /></span>}</span><span className="block p-3"><strong className="block truncate text-[13.5px]">{photo.customerName}</strong><span className="mt-1 flex items-center justify-between gap-2 text-[10.5px] text-[var(--ink-3)]"><span className="truncate">{photo.filename}</span><span className="shrink-0 capitalize">{photo.variant}</span></span></span></button>)}</div>
          : <div className="grid min-h-[320px] place-items-center text-center"><div><ImageIcon className="mx-auto text-[var(--ink-3)]" size={28} /><p className="mt-3 font-bold">{search ? "No matching photos" : "No saved photos yet"}</p><p className="mt-1 text-[12px] text-[var(--ink-3)]">{search ? "Try a shorter customer name." : "Add a photo from the Customer Library first."}</p></div></div>}
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--border-soft)] bg-white px-5 py-3"><span className="measurement text-[10.5px] text-[var(--ink-3)]">{filtered.length} photo{filtered.length === 1 ? "" : "s"}</span><button type="button" disabled={Boolean(choosingId)} onClick={onClose} className="h-10 rounded-lg border border-[var(--border)] px-4 font-semibold">Cancel</button></footer>
    </div>
  </div>;
}
