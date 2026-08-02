import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Manrope for the interface: semi-geometric, tight apertures, and a low-contrast
 * stroke that stays legible at small sizes on a dark ground. Replaces Geist,
 * which was the create-next-app default rather than a choice.
 *
 * JetBrains Mono for data. Its figures are unambiguous — slashed zero, distinct
 * 1/l/I — which matters on a floor where people read lot numbers and bin codes
 * off a screen and mistyping one is a real error.
 *
 * next/font self-hosts both at build time, so there is no runtime request to
 * Google and no layout shift.
 */
const sans = Manrope({
  variable: "--font-sans-family",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-family",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "LED Connection WMS",
  description: "Warehouse management for project-based receiving, fabrication, and shipping.",
  icons: {
    icon: "/login.svg",
    shortcut: "/login.svg",
    apple: "/login.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
