import type { ComponentProps } from "react";

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Campo de texto com rótulo visível, dica e erro ligados por aria. */
export function TextField({ name, label, hint, error, className, ...props }: TextFieldProps) {
  const hintId = hint ? `${name}-dica` : undefined;
  const errorId = error ? `${name}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          "block min-h-11 w-full rounded-sm border-2 bg-creme px-3 py-2 text-preto " +
          "placeholder:text-sepia-escuro " +
          (error ? "border-vinho" : "border-sepia focus:border-verde")
        }
        {...props}
      />
      {hint ? (
        <p id={hintId} className="mt-1 text-sm text-sepia-escuro">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-sm font-semibold text-vinho">
          {error}
        </p>
      ) : null}
    </div>
  );
}
