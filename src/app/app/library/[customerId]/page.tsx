import { notFound } from "next/navigation";
import { CustomerRecord } from "@/components/customer-record";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_PHOTO_BUCKET } from "@/lib/library/constants";

export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const supabase = await createClient();
  const [{ data: customer }, { data: photos }] = await Promise.all([
    supabase.from("customers").select("id, full_name, notes").eq("id", customerId).maybeSingle(),
    supabase.from("photos").select("id, storage_path, variant, original_filename, mime_type").eq("customer_id", customerId).order("created_at", { ascending: false }),
  ]);
  if (!customer) notFound();
  const paths = (photos ?? []).map((photo) => photo.storage_path);
  const { data: signed } = paths.length ? await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const signedByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const photoItems = (photos ?? []).map((photo) => ({ id: photo.id, storagePath: photo.storage_path, originalFilename: photo.original_filename, mimeType: photo.mime_type, variant: photo.variant as "original" | "processed", signedUrl: signedByPath.get(photo.storage_path) ?? null }));
  return <div className="p-5 sm:p-7 lg:p-8"><CustomerRecord customer={{ id: customer.id, fullName: customer.full_name, notes: customer.notes }} photos={photoItems} /></div>;
}
