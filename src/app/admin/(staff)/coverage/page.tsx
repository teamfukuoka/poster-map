import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadCoverage } from "@/features/admin/admin-service";
import { CoverageScreen } from "@/features/admin/components/coverage-screen";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { title: "カバー地域" };

// (staff) の layout は画面の移動では描き直されないことがあるので、役割はここでも確かめる。
export default async function CoveragePage() {
  const { supabase, signedIn, role } = await getStaffSession();
  if (!signedIn) redirect("/admin/login");

  if (!role) {
    return (
      <p role="alert" className="text-sm">
        このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。
      </p>
    );
  }

  const result = await loadCoverage(supabase);
  if (!result.ok) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }
  return <CoverageScreen data={result.data} now={new Date()} />;
}
