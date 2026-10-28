import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { LogoutButton } from "@/features/admin/components/logout-button";
import { HELP_PATH } from "@/features/admin/help-sections";
import { ROLE_LABELS } from "@/features/admin/role-labels";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// /admin/login はこの (staff) の外にあるので、ここからの redirect は繰り返さない。
// 子ページは遷移のたびに描き直されないことがあるため、守りの本体は DB（RPC が役割を確かめる）。
export default async function StaffLayout({ children }: { children: ReactNode }) {
  // role は「一覧にない」も「RPC のエラー」も null。未ログインとの区別は signedIn で行う
  const { signedIn, role } = await getStaffSession();
  if (!signedIn) redirect("/admin/login");

  if (!role) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-6">
        <p>このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。</p>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">ログイン中: {ROLE_LABELS[role]}</p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={HELP_PATH}>ヘルプ</Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
      <AdminNav role={role} />
      {children}
    </div>
  );
}
