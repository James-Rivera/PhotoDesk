export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header>
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]">{eyebrow}</p>
      <h1 className="mt-2 text-[26px] font-bold leading-[1.2] tracking-[-0.015em]">{title}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-[1.55] text-[var(--ink-2)]">{description}</p>
    </header>
  );
}
