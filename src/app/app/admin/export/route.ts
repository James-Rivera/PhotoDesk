import { getCurrentStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authorization = await getCurrentStaff();
  if (authorization.status !== "active") return Response.json({ error: "Authentication required" }, { status: 401 });
  if (authorization.profile.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });
  const supabase = await createClient();
  const [customers, photos] = await Promise.all([
    supabase.from("customers").select("id, full_name, notes, created_at, updated_at, created_by").order("created_at"),
    supabase.from("photos").select("id, customer_id, storage_path, variant, original_filename, mime_type, created_at, created_by").order("created_at"),
  ]);
  if (customers.error || photos.error) return Response.json({ error: "Export failed" }, { status: 500 });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), format: "cjnet-photodesk-metadata-v1", warning: "This export does not contain Supabase Storage image bytes.", customers: customers.data, photos: photos.data }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="CJNET-PhotoDesk-metadata-${date}.json"`, "cache-control": "no-store" } });
}
