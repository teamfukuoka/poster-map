import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadMembers } from "@/features/admin/admin-service";
import { MemberForm } from "@/features/admin/components/member-form";
import { MemberList } from "@/features/admin/components/member-list";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { title: "管理メンバー" };

// (staff) の layout は画面の移動では描き直されないことがあるので、役割はここでも確かめる。
// 一覧も登録も管理者だけ。DB の RPC も管理者だけを通す
export default async function MembersPage() {
  const { supabase, signedIn, role } = await getStaffSession();
  if (!signedIn) redirect("/admin/login");

  if (!role) {
    return (
      <p role="alert" className="text-sm">
        このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。
      </p>
    );
  }
  if (role !== "admin") {
    return (
      <p className="text-muted-foreground text-sm">
        管理メンバーの一覧と登録は管理者だけができます。
      </p>
    );
  }

  const result = await loadMembers(supabase);
  return (
    <div className="space-y-6">
      <MemberForm />
      {result.ok ? (
        <MemberList rows={result.data} />
      ) : (
        <p role="alert" className="text-destructive text-sm">
          {result.error}
        </p>
      )}
    </div>
  );
}
