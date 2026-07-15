"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Todos" },
  { href: "/projects", label: "Projects" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[#e8e6e1] bg-white/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink">
          Toodooz
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-ink text-white"
                    : "text-[#777] hover:bg-[#f3f2ef] hover:text-ink",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
