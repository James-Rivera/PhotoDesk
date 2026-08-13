"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_PHOTO_BUCKET } from "@/lib/library/constants";

export async function createCustomer(formData: FormData) {
  const staff = await requireActiveStaff();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!fullName || fullName.length > 160 || notes.length > 2000) throw new Error("Check the customer name and notes.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert({ full_name: fullName, notes: notes || null, created_by: staff.id }).select("id").single();
  if (error) throw new Error("The customer could not be created.");
  redirect(`/app/library/${data.id}`);
}

export async function renameCustomer(customerId: string, formData: FormData) {
  await requireActiveStaff();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!fullName || fullName.length > 160 || notes.length > 2000) throw new Error("Check the customer name and notes.");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ full_name: fullName, notes: notes || null }).eq("id", customerId);
  if (error) throw new Error("The customer could not be updated.");
  revalidatePath(`/app/library/${customerId}`);
  revalidatePath("/app/library");
}

export async function deletePhoto(customerId: string, photoId: string, storagePath: string) {
  await requireActiveStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("photos").select("storage_path").eq("id", photoId).eq("customer_id", customerId).maybeSingle();
  if (!data || data.storage_path !== storagePath) throw new Error("Photo not found.");
  const { error: storageError } = await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).remove([storagePath]);
  if (storageError) throw new Error("The private photo file could not be deleted.");
  const { error } = await supabase.from("photos").delete().eq("id", photoId).eq("customer_id", customerId);
  if (error) throw new Error("The photo record could not be deleted.");
  revalidatePath(`/app/library/${customerId}`);
  revalidatePath("/app/library");
}

export async function deleteCustomer(customerId: string) {
  await requireActiveStaff();
  const supabase = await createClient();
  const { data: photos, error: readError } = await supabase.from("photos").select("storage_path").eq("customer_id", customerId);
  if (readError) throw new Error("The customer photos could not be checked.");
  const paths = (photos ?? []).map((photo) => photo.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).remove(paths);
    if (storageError) throw new Error("The private photo files could not be deleted.");
  }
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) throw new Error("The customer could not be deleted.");
  revalidatePath("/app/library");
  redirect("/app/library");
}
