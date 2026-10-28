import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminHelpContent } from "@/features/admin/components/admin-help-content";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { title: "ヘルプ" };

// 中身は固定の説明だけ。役割は layout に任せきらず、ここでも確かめる
export default async function HelpPage() {
  const { signedIn, role } = await getStaffSession();
  if (!signedIn) redirect("/admin/login");

  if (!role) {
    return (
      <p role="alert" className="text-sm">
        このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。
      </p>
    );
  }

  return <AdminHelpContent />;
}
