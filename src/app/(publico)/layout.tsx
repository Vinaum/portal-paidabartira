import { PublicFooter, PublicHeader } from "@/components/layout/public-chrome";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <PublicFooter />
    </>
  );
}
