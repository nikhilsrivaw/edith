import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://edith.expert",
  ),
  title: {
    default: "EDITH — Every Deploy Inspected. Thoroughly. Honestly.",
    template: "%s · EDITH",
  },
  description:
    "EDITH audits AI-built Next.js apps — security, SEO, AI-surface, performance, accessibility, dependencies. Writes fix prompts for Cursor, Claude Code, and Windsurf.",
  openGraph: {
    title: "EDITH — Every Deploy Inspected. Thoroughly. Honestly.",
    description:
      "EDITH audits AI-built Next.js apps. Security, SEO, AI-surface, performance — fix prompts included.",
    url: "/",
    siteName: "EDITH",
    images: ["/opengraph-image"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EDITH — Audit AI-built apps before they ship",
    description:
      "Security, SEO, AI-surface, performance — and fix prompts your AI tool can apply.",
  },
  alternates: { canonical: "/" },
  applicationName: "EDITH",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
