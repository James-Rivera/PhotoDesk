"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImageMinus, Images, LayoutTemplate, Wrench } from "lucide-react";
import type { StaffProfile } from "@/lib/auth/staff";
import { signOut } from "@/app/app/actions";
import { SignOutButton } from "./sign-out-button";
import { WorkingPhotoProvider } from "./working-photo-context";
import { LibraryCreateForm } from "./library-create-form";

const navItems = [
  { href: "/app/template", label: "Template Builder", icon: LayoutTemplate },
  { href: "/app/remove-background", label: "Remove Background", icon: ImageMinus },
  { href: "/app/library", label: "Customer Library", icon: Images },
];

const pageContext = {
  "/app/template": ["Template Builder", "Build an exact-size A4 photo sheet"],
  "/app/remove-background": ["Remove Background", "Prepare backgrounds and color before printing"],
  "/app/library": ["Customer Library", "Saved photos in the private shop library"],
  "/app/admin": ["Maintenance", "Admin-only health checks and backup tools"],
} as const;

export function AppShell({ children, profile }: { children: React.ReactNode; profile: StaffProfile }) {
  const pathname = usePathname();
  const contextKey = Object.keys(pageContext).find((key) => pathname === key || pathname.startsWith(`${key}/`)) as keyof typeof pageContext | undefined;
  const [title, subtitle] = contextKey ? pageContext[contextKey] : pageContext["/app/template"];

  return (
    <div className="min-h-screen bg-[var(--ground)] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex border-b border-[var(--border-soft)] bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col lg:border-r lg:border-b-0">
        <Link href="/app/template" className="flex h-14 shrink-0 items-center gap-2.5 border-r border-[var(--divider)] px-4 lg:border-r-0 lg:border-b" aria-label="CJNET PhotoDesk home">
          <Image src="/assets/cjnet-logomark.png" width={22} height={23} alt="CJNET" className="h-[23px] w-[22px] object-contain" preload />
          <strong className="whitespace-nowrap text-[14px] tracking-[-0.01em]">CJNET PhotoDesk</strong>
        </Link>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto p-2.5 lg:flex-col lg:p-3.5" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href === "/app/library" && pathname.startsWith("/app/library/"));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex h-10 shrink-0 items-center gap-2.5 rounded-[9px] border px-3 text-[13.5px] transition-colors ${active ? "border-[#eedf8a] bg-[var(--brand-tint)] font-bold" : "border-transparent font-medium hover:bg-[#faf7ef]"}`}>
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-[var(--divider)] p-3 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="grid size-[30px] place-items-center rounded-full border border-[#eedf8a] bg-[var(--brand-tint)] text-[12px] font-bold">
              {initials(profile.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{profile.fullName}</p>
              <p className="text-[11px] text-[var(--ink-3)]">
                @{profile.username} ·{" "}
                <span className="capitalize">{profile.role}</span>
              </p>
            </div>
          </div>
          {profile.role === "admin" && <Link href="/app/admin" className="mt-3 flex h-[36px] w-full items-center justify-center gap-2 rounded-lg border border-[#dfc846] bg-[var(--brand-tint)] font-bold"><Wrench size={14} /> Admin Maintenance</Link>}
          <form action={signOut}><SignOutButton /></form>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[var(--border-soft)] bg-white px-5">
          <strong className="text-[15px] tracking-[-0.01em]">{title}</strong>
          <span className="mx-3 h-[18px] w-px bg-[var(--border-soft)]" aria-hidden="true" />
          <span className="truncate text-[13px] text-[var(--ink-2)]">{subtitle}</span>
          {pathname === "/app/library" && <div className="ml-auto pl-4"><LibraryCreateForm /></div>}
        </header>
        <WorkingPhotoProvider>{children}</WorkingPhotoProvider>
      </div>
    </div>
  );
}

function initials(name: string) {
  const value = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return value || "CJ";
}
