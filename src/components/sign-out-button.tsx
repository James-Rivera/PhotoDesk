"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut } from "lucide-react";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-3 flex h-[34px] w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] font-semibold disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={15} /> : <LogOut size={15} strokeWidth={1.9} />} {pending ? "Signing out…" : "Sign out"}</button>;
}
