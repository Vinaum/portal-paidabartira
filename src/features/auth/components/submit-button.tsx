"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "Enviando…",
  variant = "primary",
  ariaLabel,
}: {
  children: string;
  pendingLabel?: string;
  variant?: "primary" | "dark" | "outline";
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-disabled={pending} aria-label={ariaLabel}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
