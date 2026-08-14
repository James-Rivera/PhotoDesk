import { createClient } from "@/lib/supabase/client";
import { ALLOWED_PHOTO_TYPES, CUSTOMER_PHOTO_BUCKET, MAX_PHOTO_BYTES, safeStorageFilename } from "./constants";

export interface CustomerChoice {
  id: string;
  fullName: string;
}

export interface LibraryPhotoChoice {
  id: string;
  customerId: string;
  customerName: string;
  filename: string;
  mimeType: string;
  variant: "original" | "processed";
  createdAt: string;
  signedUrl: string | null;
}

export async function listCustomerChoices(): Promise<CustomerChoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("customers").select("id, full_name").order("full_name").limit(200);
  if (error) throw new Error("Could not load the Customer Library.");
  return (data ?? []).map((customer) => ({ id: customer.id, fullName: customer.full_name }));
}

export async function listLibraryPhotoChoices(): Promise<LibraryPhotoChoice[]> {
  const supabase = createClient();
  const [{ data: customers, error: customerError }, { data: photos, error: photoError }] = await Promise.all([
    supabase.from("customers").select("id, full_name").order("full_name").limit(200),
    supabase.from("photos").select("id, customer_id, storage_path, variant, original_filename, mime_type, created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  if (customerError || photoError) throw new Error("Could not load the Customer Library.");
  const paths = (photos ?? []).map((photo) => photo.storage_path);
  const { data: signed, error: signedError } = paths.length
    ? await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).createSignedUrls(paths, 3600)
    : { data: [], error: null };
  if (signedError) throw new Error("Could not open the private photo previews.");
  const customerNames = new Map((customers ?? []).map((customer) => [customer.id, customer.full_name]));
  const signedByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  return (photos ?? []).flatMap((photo) => {
    const customerName = customerNames.get(photo.customer_id);
    if (!customerName) return [];
    return [{
      id: photo.id,
      customerId: photo.customer_id,
      customerName,
      filename: photo.original_filename,
      mimeType: photo.mime_type,
      variant: photo.variant as "original" | "processed",
      createdAt: photo.created_at,
      signedUrl: signedByPath.get(photo.storage_path) ?? null,
    }];
  });
}

export async function saveOriginalPhotoToLibrary(input: { file: File; customerId?: string; newCustomerName?: string; variant?: "original" | "processed" }) {
  if (!ALLOWED_PHOTO_TYPES.has(input.file.type) || input.file.size > MAX_PHOTO_BYTES) {
    throw new Error("Use a JPG, PNG, or WebP photo up to 20 MB.");
  }

  const supabase = createClient();
  const { data: claims, error: claimError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimError || !userId) throw new Error("Your session expired. Sign in again.");

  let customerId = input.customerId;
  let createdCustomer = false;
  if (!customerId) {
    const fullName = input.newCustomerName?.trim() ?? "";
    if (!fullName || fullName.length > 160) throw new Error("Enter the customer's full name.");
    const { data, error } = await supabase.from("customers").insert({ full_name: fullName, notes: null, created_by: userId }).select("id").single();
    if (error) throw new Error("The customer could not be created.");
    customerId = data.id;
    createdCustomer = true;
  }

  const photoId = crypto.randomUUID();
  const storagePath = `customers/${customerId}/${photoId}/${safeStorageFilename(input.file.name)}`;
  const { error: uploadError } = await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) {
    if (createdCustomer) await supabase.from("customers").delete().eq("id", customerId);
    throw new Error("The private photo upload failed. Try again.");
  }

  const { error: insertError } = await supabase.from("photos").insert({
    id: photoId,
    customer_id: customerId,
    storage_path: storagePath,
    variant: input.variant ?? "original",
    original_filename: input.file.name.slice(0, 255),
    mime_type: input.file.type,
    created_by: userId,
  });
  if (insertError) {
    await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).remove([storagePath]);
    if (createdCustomer) await supabase.from("customers").delete().eq("id", customerId);
    throw new Error("The photo record could not be saved.");
  }

  return customerId;
}
