"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/properties", label: "Properties" },
  { href: "/brokers", label: "Brokers" },
  { href: "/dashboard", label: "My Enquiries" },
  { href: "/broker/dashboard", label: "Broker" },
  { href: "/admin", label: "Admin" },
];

export default function Navbar() {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserEmail(data.user?.email ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <header className="sticky top-0 z-40 bg-ink text-white border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="display font-black text-[19px] tracking-tight">
          Thikana<span className="text-gold">.rent</span>
          <span className="ml-2 text-[10px] font-sans font-bold bg-emerald-400 text-ink px-2 py-0.5 rounded-full align-middle">
            NCR · 5 CITIES
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[13.5px] font-semibold">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`px-3 py-2 rounded-full transition ${active(l.href) ? "bg-white text-ink" : "hover:bg-white/10"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/broker/onboard" className="text-[13px] font-bold border border-white/25 px-4 py-2 rounded-full hover:bg-white/10">
            List as broker
          </Link>
          {userEmail ? (
            <>
              <span className="hidden sm:block text-[12.5px] font-bold text-white/80 max-w-40 truncate">
                {userEmail.split("@")[0]}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-[13px] font-extrabold bg-pine px-4 py-2 rounded-full hover:bg-emerald-500"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/dashboard" className="text-[13px] font-extrabold bg-pine px-4 py-2 rounded-full hover:bg-emerald-500">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <div className="md:hidden border-t border-white/10 flex gap-1 overflow-x-auto px-4 py-2 text-[12.5px] font-semibold">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${active(l.href) ? "bg-white text-ink" : "bg-white/10"}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
