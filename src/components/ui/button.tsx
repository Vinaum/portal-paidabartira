import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "dark" | "outline";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 py-2 font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-verde text-creme hover:bg-musgo",
  dark: "bg-preto text-creme hover:bg-verde",
  outline: "border-2 border-preto text-preto hover:bg-preto hover:text-creme",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant };

export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant };

export function ButtonLink({ variant, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
