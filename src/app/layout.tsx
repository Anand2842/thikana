import type { Metadata } from "next";
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
  metadataBase: new URL("https://thikana.rent"),
  title: "Thikana — NCR's Verified Broker Marketplace",
  description:
    "NCR property search across Delhi, Gurugram, Noida, Greater Noida & Ghaziabad — verified brokers, transparent charges & fresh availability.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Navbar />
        <div className="flex-1">{children}</div>
        <footer className="bg-ink text-white/70 text-[12.5px] font-medium">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <span>
              <b className="text-white display text-[15px]">Thikana</b> · Phase 1: Delhi · Gurugram · Noida · Greater Noida · Ghaziabad.
              Verification means specific identity/business info was checked — not a safety guarantee.
            </span>
            <span className="font-mono">Prototype migrated from index.html · Phase 2: eKYC + Postgres</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
