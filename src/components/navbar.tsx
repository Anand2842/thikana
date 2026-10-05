"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
export default function Navbar() {
  const path = usePathname(),
    [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const sb = createClient();
    let mounted = true;
    sb.auth
      .getUser()
      .then(({ data }) => {
        if (mounted) setUser(data.user);
      })
      .catch(() => {});
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  const role = user?.app_metadata.role;
  const links = [
    { href: "/properties", label: "Properties" },
    { href: "/brokers", label: "Brokers" },
    { href: "/dashboard", label: "My homes" },
    ...(role === "broker" || role === "admin"
      ? [{ href: "/broker/dashboard", label: "Broker dashboard" }]
      : []),
    ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="sticky top-0 z-40 bg-ink text-white border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
        <Link href="/" className="display font-black text-xl whitespace-nowrap">
          Thikana<span className="text-gold">.rent</span>
          <span className="hidden sm:inline ml-2 text-[10px] font-sans bg-emerald-300 text-ink px-2 py-1 rounded-full">
            NCR · 5 CITIES
          </span>
        </Link>
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
          <Link
            className="border border-white/25 px-3 py-2 rounded-full"
            href={role === "broker" ? "/broker/dashboard" : "/broker/onboard"}
          >
            {role === "broker" ? "My business" : "List a home"}
          </Link>
          {user ? (
            <form action="/auth/signout" method="post">
              <button className="bg-pine px-3 py-2 rounded-full">
                Sign out
              </button>
            </form>
          ) : (
            <Link className="bg-pine px-3 py-2 rounded-full" href="/auth">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <nav
        aria-label="Main navigation"
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 flex flex-wrap gap-1 text-xs sm:text-sm font-semibold"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={
              path === l.href || path.startsWith(l.href + "/")
                ? "page"
                : undefined
            }
            className={`px-3 py-2 rounded-full ${path === l.href || path.startsWith(l.href + "/") ? "bg-white text-ink" : "hover:bg-white/10"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
