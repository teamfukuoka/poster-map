import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminRole, loadAuditLog } from "@/features/admin/admin-service";
import { AuditLogTable } from "@/features/admin/components/audit-log-table";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "操作の記録" };

// 運営も読める（RPC は operator 以上）。役割は layout に任せきらず、ここでも確かめる
export default async function AuditPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/admin/login");

  const role = await getAdminRole(supabase);
  if (!role) {
    return (
      <p role="alert" className="text-sm">
        このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。
      </p>
    );
  }

  const result = await loadAuditLog(supabase);
  if (!result.ok) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }
  return <AuditLogTable rows={result.data} />;
}
