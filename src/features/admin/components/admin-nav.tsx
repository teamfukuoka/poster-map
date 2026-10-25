"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "../types";

type Item = { href: string; label: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/admin", label: "最初の画面" },
  { href: "/admin/codes", label: "参加コード" },
  { href: "/admin/site", label: "公開とリセット", adminOnly: true },
  { href: "/admin/audit", label: "操作の記録" },
];

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => !item.adminOnly || role === "admin");
  return (
    <nav aria-label="運営メニュー" className="-mx-1 overflow-x-auto">
      <ul className="flex gap-1 px-1">
        {items.map((item) => {
          const current = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "inline-flex h-10 items-center whitespace-nowrap rounded-full bg-brand-light px-4 font-bold text-brand-dark text-sm"
                    : "inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-sm hover:bg-muted"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
