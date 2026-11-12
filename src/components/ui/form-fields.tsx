import type { ComponentProps, ReactNode } from "react";

const controlBase =
  "block w-full rounded-sm border-2 bg-creme px-3 py-2 text-preto placeholder:text-sepia-escuro ";
const controlTone = (error?: string) => (error ? "border-vinho" : "border-sepia focus:border-verde");

function describedBy(name: string, hint?: string, error?: string) {
  return [hint ? `${name}-dica` : null, error ? `${name}-erro` : null].filter(Boolean).join(" ") || undefined;
}

function Messages({ name, hint, error }: { name: string; hint?: string; error?: string }) {
  return (
    <>
      {hint ? (
        <p id={`${name}-dica`} className="mt-1 text-sm text-sepia-escuro">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-erro`} className="mt-1 text-sm font-semibold text-vinho">
          {error}
        </p>
      ) : null}
    </>
  );
}

type Common = { name: string; label: string; hint?: string; error?: string };

export function TextareaField({
  name,
  label,
  hint,
  error,
  className,
  rows = 4,
  ...props
}: Common & Omit<ComponentProps<"textarea">, "id" | "name">) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block font-semibold">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={controlBase + controlTone(error)}
        {...props}
      />
      <Messages name={name} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  className,
  children,
  ...props
}: Common & Omit<ComponentProps<"select">, "id" | "name"> & { children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block font-semibold">
        {label}
      </label>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={"min-h-11 " + controlBase + controlTone(error)}
        {...props}
      >
        {children}
      </select>
      <Messages name={name} hint={hint} error={error} />
    </div>
  );
}

export function CheckboxField({
  name,
  children,
  error,
  ...props
}: { name: string; children: ReactNode; error?: string } & Omit<ComponentProps<"input">, "id" | "name" | "type">) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={name}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-erro` : undefined}
          className="mt-1 size-5 shrink-0 accent-verde"
          {...props}
        />
        <label htmlFor={name}>{children}</label>
      </div>
      <Messages name={name} error={error} />
    </div>
  );
}
