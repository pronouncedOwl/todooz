"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

const LINKS = [
  { href: "/", label: "Todos" },
  { href: "/projects", label: "Projects" },
];

export default function AppNav({ userEmail = null, authEnabled = false }) {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) {
    return null;
  }

  return (
    <header className="border-b border-[#e8e6e1] bg-white/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink">
          Toodooz
        </Link>
        <div className="flex items-center gap-2">
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
          {authEnabled ? (
            <form action={signOut}>
              <button
                type="submit"
                title={userEmail || "Sign out"}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#777] transition-colors hover:bg-[#f3f2ef] hover:text-ink"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
