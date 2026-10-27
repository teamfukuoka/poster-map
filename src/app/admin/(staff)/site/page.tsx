import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadSiteState } from "@/features/admin/admin-service";
import { ResetRehearsal } from "@/features/admin/components/reset-rehearsal";
import { SiteControls, SiteStatus } from "@/features/admin/components/site-controls";
import { getStaffSession } from "@/features/admin/staff-session";

export const metadata: Metadata = { title: "公開とリセット" };

// (staff) の layout は画面の移動では描き直されないことがあるので、役割はここでも確かめる。
// 操作の部品は管理者にだけ描く。DB の RPC も管理者だけを通す
export default async function SitePage() {
  const { supabase, signedIn, role } = await getStaffSession();
  if (!signedIn) redirect("/admin/login");

  if (!role) {
    return (
      <p role="alert" className="text-sm">
        このアカウントでは管理画面に入れません。管理者に一覧への追加を頼んでください。
      </p>
    );
  }

  const result = await loadSiteState(supabase);
  if (!result.ok) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }
  const site = result.data;
  const now = new Date();

  return (
    <div className="space-y-6">
      <SiteStatus site={site} />
      {role === "admin" ? (
        <>
          <SiteControls site={site} beforePublicFrom={now < new Date(site.public_from)} />
          <ResetRehearsal canReset={now < new Date(site.rehearsal_reset_until)} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          公開の切り替えとリセットは管理者だけができます。
        </p>
      )}
    </div>
  );
}
