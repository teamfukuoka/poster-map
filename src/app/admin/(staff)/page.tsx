import type { Metadata } from "next";
import { loadDashboard } from "@/features/admin/admin-service";
import { Dashboard } from "@/features/admin/components/dashboard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "運営" };

export default async function AdminHomePage() {
  const result = await loadDashboard(await createClient());
  if (!result.ok) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }
  return <Dashboard data={result.data} now={new Date()} />;
}
