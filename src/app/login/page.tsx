import Image from "next/image";
import { Eye } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="grid min-h-[720px] bg-white lg:min-h-screen lg:grid-cols-2">
      <section className="flex flex-col border-b border-[var(--border-soft)] bg-[var(--surface-warm)] p-8 lg:border-r lg:border-b-0 lg:p-12">
        <Image src="/assets/cjnet-logo-full.png" width={168} height={47} alt="CJNET Internet Cafe and Xerox Copier" className="h-auto w-[168px] object-contain" preload />
        <div className="my-auto py-12">
          <div className="grid aspect-[16/10] w-full place-items-center rounded-[10px] border border-[var(--border-soft)] bg-[linear-gradient(135deg,#fbf3c2,#fffdf4)]"><div className="text-center"><Image src="/assets/cjnet-logomark.png" width={62} height={64} alt="" className="mx-auto h-16 w-16 object-contain opacity-80" /><span className="measurement mt-3 block text-[11px] text-[var(--ink-3)]">CJNET SHOP WORKSPACE</span></div></div>
          <h1 className="mt-6 text-[26px] font-bold leading-[1.2] tracking-[-0.015em]">ID photo sheets, ready to cut.</h1>
          <p className="mt-3 max-w-lg text-[14px] leading-[1.6] text-[var(--ink-2)]">Make exact-size A4 photo layouts without opening Photoshop. Choose a customer photo, select the package, then print.</p>
        </div>
        <p className="text-[12px] text-[var(--ink-3)]">Internal tool · v0.1</p>
      </section>

      <section className="grid place-items-center p-8 lg:p-12">
        <form className="w-full max-w-[400px]" action="#">
          <h2 className="text-[22px] font-bold">Sign in</h2>
          <p className="mt-2 text-[13px] text-[var(--ink-2)]">Use the account the shop owner gave you.</p>
          <div className="mt-7 space-y-[18px]">
            <label className="block"><span className="mb-1.5 block font-bold">Email address</span><input disabled type="email" autoComplete="email" className="h-[42px] w-full rounded-lg border border-[var(--border)] bg-white px-3 opacity-60" /></label>
            <label className="block"><span className="mb-1.5 block font-bold">Password</span><span className="relative block"><input disabled type="password" autoComplete="current-password" className="h-[42px] w-full rounded-lg border border-[var(--border)] bg-white px-3 pr-20 opacity-60" /><button type="button" disabled className="absolute right-1.5 top-1/2 flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-md border border-[var(--border-soft)] px-2 text-[12px] font-semibold opacity-60"><Eye size={13} /> Show</button></span></label>
          </div>
          <button disabled className="mt-[22px] h-[46px] w-full rounded-lg bg-[var(--brand-off)] font-bold text-[#9a9484]">Sign in</button>
          <p className="mt-4 text-[12.5px] leading-5 text-[var(--ink-3)]">Authentication will be connected in milestone 3. Ask the shop owner if you need an account or password reset.</p>
        </form>
      </section>
    </main>
  );
}
