import { redirect } from "next/navigation";
import { Archive, CheckCircle2, Database, Download, HardDrive, ShieldCheck } from "lucide-react";
import { getCurrentStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export default async function AdminMaintenancePage() {
  const authorization = await getCurrentStaff();
  if (authorization.status !== "active" || authorization.profile.role !== "admin") redirect("/app/template");
  const supabase = await createClient();
  const [customers, photos, profiles] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("photos").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);
  const healthy = !customers.error && !photos.error && !profiles.error;

  return <div className="p-5 sm:p-8 lg:p-10">
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <Metric icon={Database} label="Customers" value={customers.count ?? 0} ok={!customers.error} />
      <Metric icon={HardDrive} label="Photo records" value={photos.count ?? 0} ok={!photos.error} />
      <Metric icon={ShieldCheck} label="Your staff profile" value={profiles.count ?? 0} ok={!profiles.error} />
    </div>
    <section className={`mt-5 rounded-xl border p-5 ${healthy ? "border-[#cbe3c6] bg-[#eef6ec]" : "border-[#efc0b2] bg-[#fdf0ec]"}`}>
      <div className="flex items-center gap-3"><CheckCircle2 size={20} /><div><h2 className="font-bold">Database connection {healthy ? "healthy" : "needs attention"}</h2><p className="mt-1 text-[12px] text-[var(--ink-2)]">Verified authenticated access to profiles, customers, and photo metadata.</p></div></div>
    </section>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-[var(--border-soft)] bg-white p-5"><Archive size={20} /><h2 className="mt-3 text-[17px] font-bold">Operational export</h2><p className="mt-2 text-[12.5px] leading-5 text-[var(--ink-2)]">Download customer and photo metadata as JSON for audits or troubleshooting. This is not a complete disaster-recovery backup because image files are stored separately.</p><a href="/app/admin/export" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-bold"><Download size={15} /> Download metadata JSON</a></section>
      <section className="rounded-xl border border-[var(--border-soft)] bg-white p-5"><Database size={20} /><h2 className="mt-3 text-[17px] font-bold">Full backup</h2><p className="mt-2 text-[12.5px] leading-5 text-[var(--ink-2)]">Use Supabase Dashboard backups or <code>supabase db dump</code>. Database backups do not include the actual private Storage image objects, so maintain a separate Storage export plan.</p><p className="mt-4 rounded-lg border border-[#f0e3bc] bg-[#fffaed] p-3 text-[11.5px] leading-4">Never place a database password, Management API token, or service-role key in this web application.</p></section>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, ok }: { icon: typeof Database; label: string; value: number; ok: boolean }) {
  return <div className="rounded-xl border border-[var(--border-soft)] bg-white p-4"><div className="flex items-center justify-between"><Icon size={18} /><span className={`size-2 rounded-full ${ok ? "bg-[var(--ok)]" : "bg-[var(--danger)]"}`} /></div><p className="measurement mt-4 text-[24px] font-bold">{value}</p><p className="mt-1 text-[12px] text-[var(--ink-3)]">{label}</p></div>;
}
