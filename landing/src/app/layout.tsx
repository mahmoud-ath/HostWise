import type { Metadata } from "next";
import { Cabin, Instrument_Serif, Inter, Manrope } from "next/font/google";
import "./globals.css";

/**
 * HostWise brand type stack (all loaded once, optimized via next/font):
 * - Instrument Serif -> large headlines
 * - Manrope          -> navigation, UI elements, labels
 * - Inter            -> body text
 * - Cabin            -> buttons and small promotional elements
 */

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cabin = Cabin({
  subsets: ["latin"],
  variable: "--font-cabin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HostWise - Run your vacation rental business smarter",
  description:
    "A local-first desktop app for vacation-rental hosts. Track revenue, expenses, reservations, profitability, and property performance in one place, with your data staying under your control.",
  metadataBase: new URL("https://github.com/mahmoud-ath/HostWise"),
  openGraph: {
    title: "HostWise - Run your vacation rental business smarter",
    description:
      "Local-first financial intelligence for vacation-rental hosts. Revenue, expenses, analytics, and reports, all on your machine.",
    images: [
      {
        url: "https://raw.githubusercontent.com/mahmoud-ath/HostWise/main/frontend/public/logo-1024.png",
        width: 1024,
        height: 1024,
        alt: "HostWise",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${manrope.variable} ${inter.variable} ${cabin.variable}`}
    >
      <body className="min-h-[100dvh] font-sans antialiased">{children}</body>
    </html>
  );
}
