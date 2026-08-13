"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Library, LoaderCircle, Search, X } from "lucide-react";
import { listCustomerChoices, saveOriginalPhotoToLibrary, type CustomerChoice } from "@/lib/library/client";
import { useFeedback } from "./feedback-provider";

export function SavePhotoToLibraryDialog({ file, variant = "original", onClose, onSaved }: { file: File; variant?: "original" | "processed"; onClose: () => void; onSaved: (customerName: string) => void }) {
  const { toast } = useFeedback();
  const [customers, setCustomers] = useState<CustomerChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (error) toast(error, { tone: "error" }); }, [error, toast]);

  useEffect(() => {
    let active = true;
    void listCustomerChoices().then((items) => {
      if (!active) return;
      setCustomers(items);
      setSelectedId(items[0]?.id ?? "");
      if (!items.length) setMode("new");
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load customers."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => customers.filter((customer) => customer.fullName.toLowerCase().includes(search.trim().toLowerCase())), [customers, search]);

  async function save() {
    setError(null);
    const chosen = customers.find((customer) => customer.id === selectedId);
    if (mode === "existing" && !chosen) { setError("Choose a customer first."); return; }
    if (mode === "new" && !newName.trim()) { setError("Enter the customer's full name."); return; }
    setSaving(true);
    try {
      await saveOriginalPhotoToLibrary({ file, customerId: mode === "existing" ? selectedId : undefined, newCustomerName: mode === "new" ? newName : undefined, variant });
      onSaved(mode === "existing" ? chosen!.fullName : newName.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be saved.");
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,23,23,.42)] p-5" role="dialog" aria-modal="true" aria-labelledby="save-library-title"><div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(23,23,23,.22)]"><header className="flex items-center gap-3 border-b border-[var(--border-soft)] px-5 py-4"><span className="grid size-9 place-items-center rounded-full bg-[var(--brand-tint)]"><Library size={17} /></span><div><h2 id="save-library-title" className="text-[17px] font-bold">Save photo to Customer Library</h2><p className="max-w-[360px] truncate text-[11.5px] text-[var(--ink-3)]">{file.name}</p></div><button type="button" disabled={saving} onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-md" aria-label="Close"><X size={17} /></button></header><div className="p-5"><div className="grid grid-cols-2 rounded-[9px] bg-[var(--ground)] p-[3px]"><button type="button" disabled={!customers.length || saving} onClick={() => setMode("existing")} className={`h-9 rounded-[7px] font-semibold ${mode === "existing" ? "bg-white shadow-sm" : "text-[var(--ink-2)]"}`}>Existing customer</button><button type="button" disabled={saving} onClick={() => setMode("new")} className={`h-9 rounded-[7px] font-semibold ${mode === "new" ? "bg-white shadow-sm" : "text-[var(--ink-2)]"}`}>New customer</button></div>{loading ? <div className="grid min-h-36 place-items-center"><LoaderCircle className="animate-spin" size={22} /></div> : mode === "existing" ? <div className="mt-4"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer name" className="h-10 w-full rounded-lg border border-[var(--border)] pl-9 pr-3" /></label><div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-[var(--border-soft)]">{filtered.length ? filtered.map((customer) => <button type="button" key={customer.id} onClick={() => setSelectedId(customer.id)} className={`flex h-11 w-full items-center border-b border-[var(--divider)] px-3 text-left last:border-b-0 ${selectedId === customer.id ? "bg-[var(--brand-tint)] font-bold" : "hover:bg-[var(--surface-warm)]"}`}><span className="truncate">{customer.fullName}</span>{selectedId === customer.id && <Check className="ml-auto shrink-0" size={15} />}</button>) : <p className="p-4 text-center text-[12px] text-[var(--ink-3)]">No matching customers.</p>}</div></div> : <label className="mt-4 block"><span className="mb-1.5 block font-bold">Customer full name</span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={160} placeholder="Example: Juan dela Cruz" className="h-11 w-full rounded-lg border border-[var(--border)] px-3" /></label>}<p className="mt-4 text-[11.5px] leading-4 text-[var(--ink-3)]">This saves the {variant === "processed" ? "processed PNG" : "original uploaded photo"} privately. The A4 layout and crop are not uploaded.</p></div><footer className="flex justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-warm)] px-5 py-3"><button type="button" disabled={saving} onClick={onClose} className="h-10 px-3 font-semibold">Not now</button><button type="button" disabled={saving || loading} onClick={() => void save()} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={15} /> : <Library size={15} />} {saving ? "Saving…" : "Save photo"}</button></footer></div></div>;
}
