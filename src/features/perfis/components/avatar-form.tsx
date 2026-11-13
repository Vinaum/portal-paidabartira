"use client";

import { useActionState, useRef, useState } from "react";

import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { MemberPhoto } from "@/features/diretorio/components/member-photo";
import { initialFormState } from "@/lib/form";

import { removeAvatar, saveAvatar } from "../avatar-actions";

const MAX_SIDE = 1024;

/**
 * Reduz a imagem no navegador antes do envio: fotos de celular costumam passar
 * do limite do servidor. Se algo falhar, o arquivo original segue e o servidor
 * decide.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function AvatarForm({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [state, formAction] = useActionState(saveAvatar, initialFormState);
  const [removeState, removeAction] = useActionState(removeAvatar, initialFormState);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return setPreview(null);
    const smaller = await shrink(file);
    const transfer = new DataTransfer();
    transfer.items.add(smaller);
    if (input.current) input.current.files = transfer.files;
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(smaller);
    });
  }

  const message = state.message ? state : removeState.message ? removeState : null;

  return (
    <div className="flex flex-col gap-4">
      {message ? <Notice tone={message.status === "error" ? "error" : "success"}>{message.message}</Notice> : null}
      <div className="flex flex-wrap items-start gap-5">
        <MemberPhoto url={preview ?? photoUrl} name={name} size={120} />
        <form action={formAction} className="flex min-w-60 flex-1 flex-col gap-3">
          <div>
            <label htmlFor="photo" className="mb-1 block font-semibold">
              Escolher foto
            </label>
            <input
              ref={input}
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onChange}
              aria-describedby="photo-dica"
              className="block w-full min-h-11 rounded-sm border-2 border-sepia bg-creme px-3 py-2"
            />
            <p id="photo-dica" className="mt-1 text-sm text-sepia-escuro">
              JPEG, PNG ou WebP. A foto é recortada em quadrado e a localização da câmera é descartada.
            </p>
          </div>
          <div>
            <SubmitButton pendingLabel="Enviando…">Salvar foto</SubmitButton>
          </div>
        </form>
      </div>
      {photoUrl ? (
        <form action={removeAction}>
          <SubmitButton variant="outline" pendingLabel="Removendo…">
            Remover foto
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
