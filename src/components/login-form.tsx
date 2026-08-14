"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import { login, requestPasswordHelp, type LoginState, type PasswordHelpState } from "@/app/login/actions";
import { useFeedback } from "./feedback-provider";

const initialState: LoginState = { message: null };
const initialHelpState: PasswordHelpState = { status: "idle", message: null };

export function LoginForm({ configured, nextPath, reasonMessage }: { configured: boolean; nextPath: string; reasonMessage: string | null }) {
  const { toast } = useFeedback();
  const [state, action, pending] = useActionState(login, initialState);
  const [helpState, helpAction, helpPending] = useActionState(requestPasswordHelp, initialHelpState);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const disabled = !configured || pending;
  const errorMessage = state.message ?? reasonMessage;

  useEffect(() => { if (errorMessage) toast(errorMessage, { tone: "error" }); }, [errorMessage, toast]);
  useEffect(() => {
    if (helpState.message) toast(helpState.message, { tone: helpState.status === "success" ? "success" : "error" });
  }, [helpState, toast]);

  return <div className="w-full max-w-[400px]"><form action={action}>
    <h2 className="text-[22px] font-bold">Sign in</h2>
    <p className="mt-2 text-[13px] text-[var(--ink-2)]">Use the account the shop owner gave you.</p>
    {!configured && <div className="mt-5 rounded-lg border border-[#f0e3bc] bg-[#fffaed] p-3 text-[12.5px] leading-5 text-[var(--ink-2)]"><strong className="block text-[var(--ink)]">Setup required</strong>Add the public Supabase URL and publishable key to <code>.env.local</code>, then restart the app.</div>}
    <input type="hidden" name="next" value={nextPath} />
    <div className="mt-7 space-y-[18px]">
      <label className="block"><span className="mb-1.5 block font-bold">Email address</span><input required disabled={disabled} name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} className="h-[42px] w-full rounded-lg border border-[var(--border)] bg-white px-3 disabled:opacity-60" /></label>
      <label className="block"><span className="mb-1.5 flex items-center justify-between gap-3"><strong>Password</strong><button type="button" onClick={() => setShowPasswordHelp((value) => !value)} className="text-[12px] font-bold underline underline-offset-2">Forgot password?</button></span><span className="relative block"><input required disabled={disabled} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-[42px] w-full rounded-lg border border-[var(--border)] bg-white px-3 pr-20 disabled:opacity-60" /><button type="button" disabled={disabled} onClick={() => setShowPassword((value) => !value)} className="absolute right-1.5 top-1/2 flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-md border border-[var(--border-soft)] px-2 text-[12px] font-semibold disabled:opacity-60" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={13} /> : <Eye size={13} />} {showPassword ? "Hide" : "Show"}</button></span></label>
    </div>
    <button disabled={disabled} className="mt-[22px] flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] font-bold hover:bg-[var(--brand-hover)] disabled:bg-[var(--brand-off)] disabled:text-[#9a9484]">{pending && <LoaderCircle className="animate-spin" size={16} />} {pending ? "Signing in…" : "Sign in"}</button>
    <p className="mt-4 text-[12.5px] leading-5 text-[var(--ink-3)]">There is no public registration. Accounts are managed by the shop administrator.</p>
  </form>
  {showPasswordHelp && <form action={helpAction} className="mt-5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-warm)] p-4">
    <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[var(--ink-2)]"><Mail size={16} /></span><div><strong className="text-[13px]">Ask the administrator for help</strong><p className="mt-1 text-[11.5px] leading-4 text-[var(--ink-2)]">We’ll email the administrator. They will verify your account and contact you.</p></div></div>
    <label className="mt-3 block"><span className="mb-1.5 block text-[11.5px] font-bold">Your staff email</span><input required disabled={helpPending} name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 disabled:opacity-60" /></label>
    <button disabled={helpPending} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--ink)] bg-white font-bold disabled:opacity-60">{helpPending && <LoaderCircle className="animate-spin" size={15} />} {helpPending ? "Sending request…" : "Email administrator"}</button>
    {helpState.message && <p aria-live="polite" className={`mt-3 text-[11.5px] leading-4 ${helpState.status === "success" ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{helpState.message}</p>}
  </form>}
  </div>;
}
