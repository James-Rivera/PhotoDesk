"use client";

import { Download, LoaderCircle, Printer, RefreshCw, Settings2, X } from "lucide-react";
import type { PrintHelperHealth } from "@/lib/printing/print-helper";

interface NativePrintDialogProps {
  generating: boolean;
  helper: PrintHelperHealth;
  pairingCode: string;
  onPairingCode: (value: string) => void;
  onRefresh: () => void;
  onPair: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onBrowserPrint: () => void;
}

export function NativePrintDialog(props: NativePrintDialogProps) {
  const ready = props.helper.available && props.helper.paired;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,23,23,.42)] p-5" role="dialog" aria-modal="true" aria-labelledby="native-print-title">
    <div className="w-full max-w-[650px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(23,23,23,.22)]">
      <header className="flex min-h-[58px] items-center gap-3 border-b border-[var(--border-soft)] px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)]"><Settings2 size={18} /></span>
        <div><h2 id="native-print-title" className="text-[17px] font-bold">Print using Windows</h2><p className="text-[11.5px] text-[var(--ink-3)]">Native A4 preview with job-only printer settings</p></div>
        <button type="button" onClick={props.onCancel} className="ml-auto grid size-8 place-items-center rounded-md hover:bg-[#faf7ef]" aria-label="Close print settings"><X size={17} /></button>
      </header>
      <div className="p-5">
        <div className={`rounded-lg border p-3.5 ${ready ? "border-[#cbe3c6] bg-[#eef6ec]" : "border-[#eedf8a] bg-[#fffcea]"}`}>
          <div className="flex items-start justify-between gap-3"><div><strong>{ready ? "CJNET Print Helper is ready" : props.helper.available ? "Pair this computer once" : "CJNET Print Helper is not running"}</strong><p className="mt-1 text-[12px] leading-5 text-[var(--ink-2)]">{ready ? `Version ${props.helper.version ?? "installed"} · Windows printing available` : props.helper.available ? "Right-click the helper tray icon, show its pairing code, then enter it below." : "Install or start the helper on this computer, then check again."}</p></div><button type="button" onClick={props.onRefresh} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 font-semibold"><RefreshCw size={13} /> Check</button></div>
          {props.helper.available && !props.helper.paired && <div className="mt-3 flex gap-2"><input inputMode="numeric" maxLength={6} value={props.pairingCode} onChange={(event) => props.onPairingCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" aria-label="Print helper pairing code" className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3" /><button type="button" disabled={props.pairingCode.length !== 6 || props.generating} onClick={props.onPair} className="h-9 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-50">Pair</button></div>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><Setting label="Paper" value="A4 · Portrait" /><Setting label="Size" value="Actual size · no scaling" important /><Setting label="Epson Preferences" value="Photo Quality Ink Jet" important /><Setting label="Quality / color" value="Standard or High · Color" /></div>
        <p className="mt-3 text-[11.5px] leading-4 text-[var(--ink-3)]">The helper shows the print-ready A4 sheet. Choose a printer, use <b>PhotoDesk job settings</b> for paper and quality, then select Print. Those choices will not replace the defaults used by Word or browser printing.</p>
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-warm)] px-5 py-3"><button type="button" onClick={props.onCancel} className="h-10 rounded-lg px-3 font-semibold">Cancel</button><button type="button" onClick={props.onDownload} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 font-semibold"><Download size={15} /> Download PDF</button><button type="button" onClick={props.onBrowserPrint} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 font-semibold">Browser fallback</button><button type="button" disabled={!ready || props.generating} onClick={props.onPrint} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-50">{props.generating ? <LoaderCircle className="animate-spin" size={16} /> : <Printer size={16} />} Open Windows print</button></footer>
    </div>
  </div>;
}

function Setting({ label, value, important = false }: { label: string; value: string; important?: boolean }) {
  return <div className={`rounded-lg border p-3 ${important ? "border-[#eedf8a] bg-[#fffcea]" : "border-[var(--border-soft)] bg-[var(--surface-warm)]"}`}><span className="block text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{label}</span><strong className="mt-1 block text-[12.5px]">{value}</strong></div>;
}
