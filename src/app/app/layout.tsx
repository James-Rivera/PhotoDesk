import { AppShell } from "@/components/app-shell";

export default function ProtectedAreaLayout({ children }: { children: React.ReactNode }) {
  // Milestone 3 adds the server-side authenticated profile gate here.
  return <AppShell>{children}</AppShell>;
}
