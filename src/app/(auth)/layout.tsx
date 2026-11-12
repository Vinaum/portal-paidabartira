import type { Metadata } from "next";
import Link from "next/link";

import { LogoSeal } from "@/components/layout/logo-seal";
import { site } from "@/config/site";

export const metadata: Metadata = { robots: { index: false } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex flex-col items-center gap-2 text-center">
        <LogoSeal size={88} />
        <span className="font-display text-2xl font-bold">{site.name}</span>
      </Link>
      <div className="rounded-sm border border-sepia bg-papel p-6">{children}</div>
    </main>
  );
}
