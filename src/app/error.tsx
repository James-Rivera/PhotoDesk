"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useFeedback } from "@/components/feedback-provider";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { toast } = useFeedback();
  useEffect(() => { toast("PhotoDesk could not load this part of the app. Please try again.", { tone: "error" }); }, [toast]);
  return <main className="grid min-h-[60vh] place-items-center p-6"><div className="w-full max-w-md rounded-xl border border-[#efc0b2] bg-white p-6 text-center shadow-sm"><span className="mx-auto grid size-11 place-items-center rounded-full bg-[#fdf0ec] text-[var(--danger)]"><AlertTriangle size={21} /></span><h1 className="mt-4 text-[18px] font-bold">This page needs another try</h1><p className="mt-2 text-[13px] leading-5 text-[var(--ink-2)]">Your saved customer photos are not changed. Retry the page, then check the internet connection if it happens again.</p><button type="button" onClick={reset} className="mx-auto mt-5 flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-bold"><RotateCcw size={15} /> Try again</button></div></main>;
}
