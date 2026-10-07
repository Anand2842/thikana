import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: "Thikana — NCR's Verified Broker Marketplace",
  description:
    "NCR property search across Delhi, Gurugram, Noida, Greater Noida & Ghaziabad — verified brokers, transparent charges & fresh availability.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Navbar />
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <p className="bg-mist text-pinedark text-center text-xs font-semibold px-4 py-2">
            Demo workspace · Sample homes, brokers and reviews for testing.
          </p>
        )}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 button"
        >
          Skip to content
        </a>
        <div id="main-content" className="flex-1">
          {children}
        </div>
        <footer className="bg-ink text-white/70 text-[12.5px] font-medium">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <span>
              <b className="text-white display text-[15px]">Thikana</b> · Delhi
              · Gurugram · Noida · Greater Noida · Ghaziabad. Verification means
              specific identity/business info was checked — not a safety
              guarantee.
            </span>
            <span>Transparent fees. Current availability. Human review.</span>
            <nav
              aria-label="Legal and support"
              className="flex flex-wrap gap-4 text-[12.5px] font-bold"
            >
              <Link className="underline" href="/support">
                Support
              </Link>
              <Link className="underline" href="/terms">
                Terms
              </Link>
              <Link className="underline" href="/privacy">
                Privacy
              </Link>
              <Link className="underline" href="/broker-agreement">Broker Agreement</Link>
              <Link className="underline" href="/support/privacy">Privacy &amp; appeals</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
