import type { Metadata } from "next";
import { LoginForm } from "@/features/admin/components/login-form";

// シェアしたときのカードは公開の画面だけ（layout の openGraph・twitter を外す）
export const metadata: Metadata = { title: "運営ログイン", openGraph: null, twitter: null };

type Props = { searchParams: Promise<{ error?: string | string[] }> };

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <LoginForm
      showPasswordLogin={process.env.ADMIN_PASSWORD_LOGIN === "local"}
      hasError={error !== undefined}
    />
  );
}
