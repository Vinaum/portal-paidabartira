"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";
import { shrinkImage } from "@/lib/shrink-image";

import { addAlbumPhoto, deleteAlbum, removeAlbumPhoto, saveAlbum, setMuseumHidden } from "../actions";

export type AlbumFormValues = { id: string; title: string; description: string; year: string; visibility: "public" | "members" };
const EMPTY: AlbumFormValues = { id: "", title: "", description: "", year: "", visibility: "members" };

export function AlbumForm({ album = EMPTY }: { album?: AlbumFormValues }) {
  const [state, formAction] = useActionState(saveAlbum, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = (key: "title" | "description" | "year" | "visibility") => state.values?.[key] ?? album[key];
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="albumId" value={album.id} />
      <TextField name="title" label="Título" required maxLength={120} defaultValue={v("title")} error={errors.title} />
      <TextField name="year" label="Ano (opcional)" inputMode="numeric" maxLength={4} defaultValue={v("year")} hint="Exemplo: 2008." error={errors.year} />
      <TextareaField name="description" label="Descrição (opcional)" rows={4} maxLength={1000} defaultValue={v("description")} error={errors.description} />
      <SelectField name="visibility" label="Quem pode ver" defaultValue={v("visibility")} error={errors.visibility}>
        <option value="members">Só integrantes</option>
        <option value="public">Qualquer pessoa (público)</option>
      </SelectField>
      <p className="text-sm text-sepia-escuro">
        Só marque como público se as pessoas que aparecem nas fotos concordam. Qualquer integrante pode adicionar fotos
        ao álbum, então avise a turma. Não é possível marcar pessoas nas fotos.
      </p>
      <div>
        <SubmitButton pendingLabel="Salvando…">{album.id ? "Salvar álbum" : "Criar álbum"}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAlbumForm({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteAlbum, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" pendingLabel="Apagando…">
        Apagar álbum e todas as fotos
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function AlbumPhotoForm({ albumId }: { albumId: string }) {
  const [state, formAction] = useActionState(addAlbumPhoto, initialFormState);
  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(await shrinkImage(file));
    event.target.files = transfer.files;
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="albumId" value={albumId} />
      <label className="flex flex-col gap-1 font-semibold">
        Adicionar foto
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required onChange={onChange} className="font-normal" />
      </label>
      <TextField name="caption" label="Legenda (opcional)" maxLength={200} error={state.fieldErrors?.caption} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Enviando…">
          Enviar foto
        </SubmitButton>
      </div>
    </form>
  );
}

export function RemoveAlbumPhotoForm({ albumId, photoId }: { albumId: string; photoId: string }) {
  const [state, formAction] = useActionState(removeAlbumPhoto, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="albumId" value={albumId} />
      <input type="hidden" name="photoId" value={photoId} />
      <SubmitButton variant="outline" pendingLabel="Removendo…">
        Remover foto
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function HideMuseumItemForm({
  kind,
  id,
  albumId,
  hidden,
}: {
  kind: "album" | "photo";
  id: string;
  albumId: string;
  hidden: boolean;
}) {
  const [state, formAction] = useActionState(setMuseumHidden, initialFormState);
  const noun = kind === "album" ? "álbum" : "foto";
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="albumId" value={albumId} />
      <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
      {!hidden ? <TextField name="reason" label="Motivo (visível a quem enviou)" maxLength={200} error={state.fieldErrors?.reason} /> : null}
      <div>
        <SubmitButton variant="outline" pendingLabel="Salvando…">
          {hidden ? `Reexibir ${noun}` : `Ocultar ${noun}`}
        </SubmitButton>
      </div>
    </form>
  );
}
