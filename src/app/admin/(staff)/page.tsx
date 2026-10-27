import type { Metadata } from "next";
import { loadDashboard } from "@/features/admin/admin-service";
import { Dashboard } from "@/features/admin/components/dashboard";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { title: "運営" };

export default async function AdminHomePage() {
  const { supabase, role } = await getStaffSession();
  // 一覧にない人には layout が案内を出す。ここで RPC を投げても not_admin になるだけなので投げない
  if (!role) return null;
  const result = await loadDashboard(supabase);
  if (!result.ok) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }
  return <Dashboard data={result.data} now={new Date()} />;
}
