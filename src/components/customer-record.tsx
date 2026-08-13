"use client";
/* eslint-disable @next/next/no-img-element -- short-lived private Supabase signed URLs */

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ImagePlus, LoaderCircle, Send, Trash2 } from "lucide-react";
import { deleteCustomer, deletePhoto, renameCustomer } from "@/app/app/library/actions";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_PHOTO_TYPES, CUSTOMER_PHOTO_BUCKET, MAX_PHOTO_BYTES, safeStorageFilename } from "@/lib/library/constants";
import { useFeedback } from "./feedback-provider";
import { useWorkingPhoto } from "./working-photo-context";

interface PhotoItem { id: string; storagePath: string; originalFilename: string; mimeType: string; variant: "original" | "processed"; signedUrl: string | null }

export function CustomerRecord({ customer, photos }: { customer: { id: string; fullName: string; notes: string | null }; photos: PhotoItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { sendToTemplate } = useWorkingPhoto();
  const { confirm, toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  function saveCustomer(formData: FormData) { startTransition(async () => { try { await renameCustomer(customer.id, formData); setEditing(false); toast("Customer details updated.", { tone: "success" }); router.refresh(); } catch { toast("Could not update the customer.", { tone: "error" }); } }); }
  async function removeCustomer() {
    const approved = await confirm({ title: `Delete ${customer.fullName}?`, body: "Every saved photo for this customer will also be permanently deleted. This cannot be undone.", cancelLabel: "Keep customer", confirmLabel: "Delete customer", destructive: true });
    if (!approved) return;
    startTransition(async () => { try { await deleteCustomer(customer.id); } catch { toast("Could not delete the customer.", { tone: "error" }); } });
  }
  async function removePhoto(photo: PhotoItem) {
    const approved = await confirm({ title: "Delete this photo?", body: `${photo.originalFilename} will be permanently removed from the private library.`, cancelLabel: "Keep photo", confirmLabel: "Delete photo", destructive: true });
    if (!approved) return;
    startTransition(async () => { try { await deletePhoto(customer.id, photo.id, photo.storagePath); toast("Photo deleted.", { tone: "success" }); router.refresh(); } catch { toast("Could not delete the photo.", { tone: "error" }); } });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const selected = Array.from(files);
      const invalid = selected.find((file) => !ALLOWED_PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_BYTES);
      if (invalid) throw new Error("Use JPG, PNG, or WebP files up to 20 MB each.");
      const supabase = createClient();
      const { data: claims, error: claimError } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub;
      if (claimError || !userId) throw new Error("Your session expired. Sign in again.");
      for (const file of selected) {
        const photoId = crypto.randomUUID();
        const storagePath = `customers/${customer.id}/${photoId}/${safeStorageFilename(file.name)}`;
        const { error: uploadError } = await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("photos").insert({ id: photoId, customer_id: customer.id, storage_path: storagePath, variant: "original", original_filename: file.name.slice(0, 255), mime_type: file.type, created_by: userId });
        if (insertError) { await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).remove([storagePath]); throw insertError; }
      }
      toast(`${selected.length} photo${selected.length === 1 ? "" : "s"} saved privately.`, { tone: "success" });
      router.refresh();
    } catch (cause) { toast(cause instanceof Error ? cause.message : "The upload failed.", { tone: "error" }); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function sendPhotoToTemplate(photo: PhotoItem) {
    if (!photo.signedUrl) { toast("This private photo link expired. Refresh and try again.", { tone: "error" }); return; }
    try {
      const response = await fetch(photo.signedUrl);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      sendToTemplate(new File([blob], photo.originalFilename, { type: photo.mimeType }));
      router.push("/app/template");
    } catch { toast("Could not load the private photo.", { tone: "error" }); }
  }

  return <section className="overflow-hidden rounded-xl border border-[#dfc846] bg-white shadow-[0_5px_18px_rgba(23,23,23,.06)]">
    <div className="border-b border-[#eadf9f] bg-[linear-gradient(120deg,#fffdf4_0%,#fbf3c2_100%)] p-5 sm:p-6">
      {editing ? <form action={saveCustomer} className="grid gap-4 lg:grid-cols-2">
        <label><span className="mb-1.5 block font-bold">Full name</span><input required name="fullName" defaultValue={customer.fullName} maxLength={160} className="h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3" /></label>
        <label><span className="mb-1.5 block font-bold">Notes</span><textarea name="notes" defaultValue={customer.notes ?? ""} maxLength={2000} rows={3} className="w-full resize-none rounded-lg border border-[var(--border)] bg-white p-3" /></label>
        <div className="flex justify-end gap-2 lg:col-span-2"><button type="button" onClick={() => setEditing(false)} className="h-10 px-3 font-semibold">Cancel</button><button disabled={pending} className="h-10 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-60">Save changes</button></div>
      </form> : <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><Link href="/app/library" className="inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 font-semibold text-[var(--ink-2)] hover:bg-white/70 hover:text-[var(--ink)]"><ArrowLeft size={14} /> Back to Library</Link><h1 className="mt-2 truncate text-[22px] font-bold tracking-[-.015em]">{customer.fullName}</h1>{customer.notes && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-[13px] leading-5 text-[var(--ink-2)]">{customer.notes}</p>}</div>
        <div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setEditing(true)} className="h-10 rounded-lg border border-[#d4c77c] bg-white px-3 font-semibold">Rename / edit</button><button disabled={pending} onClick={() => void removeCustomer()} className="flex h-10 items-center gap-2 rounded-lg border border-[#efc0b2] bg-white px-3 font-semibold text-[var(--danger)] disabled:opacity-60"><Trash2 size={15} /> Delete customer</button></div>
      </div>}
    </div>

    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2"><h2 className="text-[17px] font-bold">Saved photos</h2><span className="measurement text-[11px] text-[var(--ink-3)]">{photos.length}</span></div>
        <input ref={inputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files)} />
        <button disabled={uploading} onClick={() => inputRef.current?.click()} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-bold disabled:opacity-60">{uploading ? <LoaderCircle className="animate-spin" size={16} /> : <ImagePlus size={16} />} {uploading ? "Uploading…" : "Add photos"}</button>
      </div>

      {photos.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{photos.map((photo) => <article key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white shadow-[0_2px_8px_rgba(23,23,23,.04)]"><div className="grid aspect-[4/3] place-items-center bg-[var(--ground)]">{photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalFilename} className="h-full w-full object-contain" /> : <span className="text-[12px] text-[var(--ink-3)]">Preview unavailable</span>}</div><div className="p-3"><p className="truncate font-bold">{photo.originalFilename}</p><p className="mt-1 text-[11px] capitalize text-[var(--ink-3)]">{photo.variant}</p><div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2"><button disabled={!photo.signedUrl} onClick={() => void sendPhotoToTemplate(photo)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-2 font-bold disabled:opacity-50"><Send size={14} /> Use in Template</button><a href={photo.signedUrl ?? undefined} download={photo.originalFilename} aria-disabled={!photo.signedUrl} className="grid size-9 place-items-center rounded-lg border border-[var(--border)]" title="Download"><Download size={14} /></a><button disabled={pending} onClick={() => void removePhoto(photo)} className="grid size-9 place-items-center rounded-lg border border-[#efc0b2] text-[var(--danger)] disabled:opacity-60" title="Delete photo"><Trash2 size={14} /></button></div></div></article>)}</div> : <div className="mt-4 grid min-h-[260px] place-items-center rounded-xl border border-dashed border-[#d9cb78] bg-[var(--surface-warm)] text-center"><div><ImagePlus className="mx-auto text-[var(--ink-3)]" /><p className="mt-3 font-bold">No photos saved yet</p><button onClick={() => inputRef.current?.click()} className="mt-3 h-9 rounded-lg border border-[#d4c77c] bg-white px-3 font-semibold">Choose the first photo</button></div></div>}
    </div>
  </section>;
}
