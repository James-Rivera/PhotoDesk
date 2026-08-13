import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentStaff } from "@/lib/auth/staff";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const reasonMessages: Record<string, string> = {
  session: "Your session expired. Sign in again to continue.",
  profile: "Your staff profile could not be verified. Ask the shop administrator to check the account.",
  inactive: "This staff account is inactive. Ask the shop administrator for access.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const nextPath = getSafeNextPath(params.next);
  if (configured) {
    const staff = await getCurrentStaff();
    if (staff.status === "active") redirect(nextPath);
  }
  return (
    <main className="grid h-dvh overflow-hidden bg-white lg:grid-cols-2">
      <section className="flex flex-col border-b border-[var(--border-soft)] bg-[var(--surface-warm)] p-8 lg:border-r lg:border-b-0 lg:p-12">
        <Image src="/assets/cjnet-logo-full.png" width={168} height={47} alt="CJNET Internet Cafe and Xerox Copier" className="h-auto w-[168px] object-contain" preload />
        <div className="my-auto py-12">
          <h1 className="mt-6 text-[26px] font-bold leading-[1.2] tracking-[-0.015em]">ID photo sheets, ready to cut.</h1>
          <p className="mt-3 max-w-lg text-[14px] leading-[1.6] text-[var(--ink-2)]">Make exact-size A4 photo layouts without opening Photoshop. Choose a customer photo, select the package, then print.</p>
        </div>
        <p className="text-[12px] text-[var(--ink-3)]">Internal tool · v0.1</p>
      </section>

      <section className="grid place-items-center p-8 lg:p-12">
        <LoginForm configured={configured} nextPath={nextPath} reasonMessage={params.reason ? reasonMessages[params.reason] ?? null : null} />
      </section>
    </main>
  );
}
