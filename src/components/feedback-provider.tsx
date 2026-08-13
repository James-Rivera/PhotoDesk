"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface FeedbackValue {
  toast: (message: string, options?: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const timers = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = crypto.randomUUID();
    const tone = options.tone ?? "info";
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    const duration = options.duration ?? (tone === "error" ? 6500 : 4200);
    timers.current.set(id, window.setTimeout(() => dismissToast(id), duration));
  }, [dismissToast]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    confirmationResolver.current?.(false);
    confirmationResolver.current = resolve;
    setConfirmation(options);
  }), []);

  const finishConfirmation = useCallback((confirmed: boolean) => {
    confirmationResolver.current?.(confirmed);
    confirmationResolver.current = null;
    setConfirmation(null);
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishConfirmation(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [confirmation, finishConfirmation]);

  useEffect(() => () => {
    confirmationResolver.current?.(false);
    for (const timer of timers.current.values()) window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => { if (event.error) toast("Something went wrong in PhotoDesk. Your current work may still be available; try the action again.", { tone: "error" }); };
    const handleRejection = () => toast("PhotoDesk could not finish that action. Check the connection and try again.", { tone: "error" });
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [toast]);

  return <FeedbackContext.Provider value={{ toast, confirm }}>
    {children}

    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(390px,calc(100%-32px))] flex-col gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => <Toast key={item.id} item={item} onDismiss={() => dismissToast(item.id)} />)}
    </div>

    {confirmation && <div onMouseDown={(event) => { if (event.target === event.currentTarget) finishConfirmation(false); }} className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(23,23,23,.46)] p-5" role="dialog" aria-modal="true" aria-labelledby="global-confirm-title" aria-describedby="global-confirm-body">
      <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white shadow-[0_20px_52px_rgba(23,23,23,.24)]">
        <div className="p-5">
          <span className={`grid size-10 place-items-center rounded-lg ${confirmation.destructive ? "bg-[#fdf0ec] text-[var(--danger)]" : "bg-[var(--brand-tint)] text-[var(--warn)]"}`}><AlertTriangle size={19} /></span>
          <h2 id="global-confirm-title" className="mt-4 text-[17px] font-bold">{confirmation.title}</h2>
          <p id="global-confirm-body" className="mt-2 text-[13px] leading-[1.55] text-[var(--ink-2)]">{confirmation.body}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-warm)] px-5 py-3">
          <button type="button" autoFocus onClick={() => finishConfirmation(false)} className="h-10 rounded-lg border border-[var(--border)] bg-white px-4 font-semibold">{confirmation.cancelLabel ?? "Cancel"}</button>
          <button type="button" onClick={() => finishConfirmation(true)} className={`h-10 rounded-lg px-4 font-bold ${confirmation.destructive ? "border border-[#d48b79] bg-white text-[var(--danger)]" : "bg-[var(--brand)]"}`}>{confirmation.confirmLabel ?? "Continue"}</button>
        </div>
      </div>
    </div>}
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used inside FeedbackProvider.");
  return value;
}

export function FeedbackToast({ message, tone = "error" }: { message: string; tone?: ToastTone }) {
  const { toast } = useFeedback();
  useEffect(() => { toast(message, { tone }); }, [message, tone, toast]);
  return null;
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? XCircle : Info;
  const colors = item.tone === "success"
    ? "border-[#a9d1a2] bg-[#eef6ec] text-[#255c2f]"
    : item.tone === "error"
      ? "border-[#e8a795] bg-[#fdf0ec] text-[#8c2410]"
      : "border-[#e4d26a] bg-[#fffbea] text-[var(--ink)]";
  return <div role={item.tone === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-[0_10px_30px_rgba(23,23,23,.14)] ${colors}`}>
    <Icon className="mt-0.5 shrink-0" size={18} />
    <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-5">{item.message}</p>
    <button type="button" onClick={onDismiss} className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-black/5" aria-label="Dismiss notification"><X size={14} /></button>
  </div>;
}
