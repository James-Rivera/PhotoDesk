"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { createCustomer } from "@/app/app/library/actions";
import { useFeedback } from "./feedback-provider";

export function LibraryCreateForm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { toast } = useFeedback();
  async function submit(formData: FormData) {
    try { await createCustomer(formData); }
    catch { toast("The customer could not be created. Check the name and try again.", { tone: "error" }); }
  }
  return <><button type="button" onClick={() => dialogRef.current?.showModal()} className="flex h-9 items-center gap-2 rounded-lg bg-[var(--brand)] px-3.5 font-bold"><Plus size={15} /> Add customer</button><dialog ref={dialogRef} className="m-auto w-[min(460px,calc(100%-32px))] rounded-xl bg-white p-0 text-[var(--ink)] shadow-xl backdrop:bg-black/40"><form action={submit}><header className="flex items-center border-b border-[var(--border-soft)] px-5 py-4"><h2 className="text-[17px] font-bold">Create customer</h2><button type="button" onClick={() => dialogRef.current?.close()} className="ml-auto grid size-8 place-items-center rounded-md" aria-label="Close"><X size={17} /></button></header><div className="space-y-4 p-5"><label className="block"><span className="mb-1.5 block font-bold">Full name</span><input required name="fullName" maxLength={160} autoFocus className="h-11 w-full rounded-lg border border-[var(--border)] px-3" /></label><label className="block"><span className="mb-1.5 block font-bold">Notes <span className="font-normal text-[var(--ink-3)]">(optional)</span></span><textarea name="notes" maxLength={2000} rows={3} className="w-full resize-none rounded-lg border border-[var(--border)] p-3" /></label></div><footer className="flex justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-warm)] px-5 py-3"><button type="button" onClick={() => dialogRef.current?.close()} className="h-10 px-3 font-semibold">Cancel</button><CreateButton /></footer></form></dialog></>;
}

function CreateButton() { const { pending } = useFormStatus(); return <button disabled={pending} className="h-10 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-60">{pending ? "Creating…" : "Create customer"}</button>; }
