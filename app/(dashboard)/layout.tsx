import type { Metadata } from "next";
import { Sidebar } from "@/components/edith/sidebar";
import { DashboardBackground } from "@/components/edith/dashboard-background";

// Dashboard routes are private to the signed-in user — no value to crawlers,
// and `robots.txt` already disallows them. The meta-robots tag here is a
// defense-in-depth in case any single page is accidentally exposed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardBackground />
      <div className="relative z-10 flex min-h-svh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
