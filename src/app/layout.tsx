import type { Metadata } from "next";

import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/source-sans-3/index.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "./globals.css";

import { site } from "@/config/site";

export const metadata: Metadata = {
  title: { default: `República ${site.name}`, template: `%s · ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
