import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { isBranchLocalMode } from "@/lib/auth/local";

export default async function ProtectedAreaLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (staff.status === "unconfigured") redirect("/login?reason=setup");
  if (staff.status === "unauthenticated") redirect("/login?reason=session");
  if (staff.status === "profile-missing") redirect("/login?reason=profile");
  if (staff.status === "inactive") redirect("/login?reason=inactive");
  return <AppShell profile={staff.profile} branchLocal={isBranchLocalMode()}>{children}</AppShell>;
}
