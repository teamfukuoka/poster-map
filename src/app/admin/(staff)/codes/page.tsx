import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadInviteCodes } from "@/features/admin/admin-service";
import { InviteCodeForm } from "@/features/admin/components/invite-code-form";
import { InviteCodeTable } from "@/features/admin/components/invite-code-table";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { title: "参加コード" };

// (staff) の layout は画面の移動では描き直されないことがあるので、役割はここでも確かめる。
// 一覧にはコードの平文を含めない（has_code だけ）。「表示」を押したときにだけ別に取る。
export default async function InviteCodesPage() {
  const { supabase, signedIn, role } = await getStaffSession();
  if (!signedIn) redirect("/admin/login");

  if (!role) {
    return (
      <p role="alert" className="text-sm">
        このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。
      </p>
    );
  }
  const isAdmin = role === "admin";

  const result = await loadInviteCodes(supabase);
  return (
    <div className="space-y-6">
      {isAdmin && <InviteCodeForm />}
      {result.ok ? (
        <InviteCodeTable rows={result.data} isAdmin={isAdmin} />
      ) : (
        <p role="alert" className="text-destructive text-sm">
          {result.error}
        </p>
      )}
    </div>
  );
}
