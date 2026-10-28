import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          // Vercel の既定（max-age のみ）に includeSubDomains を足す。preload は親ドメインの登録が要るので付けない
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // ほかのサイトのウィンドウから window を触らせない（外部リンクは noopener、Google ログインは画面遷移なので影響しない）
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
