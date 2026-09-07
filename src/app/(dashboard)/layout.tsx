import type { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start min-h-screen w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-60 lg:ml-64 px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-28 md:pb-12">
        <div className="mx-auto w-full max-w-[900px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
