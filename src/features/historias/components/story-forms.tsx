"use client";

import { useActionState, useEffect, useRef } from "react";

import { TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";
import { shrinkImage } from "@/lib/shrink-image";

import { addComment, addStoryPhoto, deleteComment, deleteStory, removeStoryPhoto, saveStory, setStoryHidden } from "../actions";

export type StoryFormValues = { id: string; title: string; body: string; era: string };
const EMPTY: StoryFormValues = { id: "", title: "", body: "", era: "" };

export function StoryForm({ story = EMPTY }: { story?: StoryFormValues }) {
  const [state, formAction] = useActionState(saveStory, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = (key: "title" | "body" | "era") => state.values?.[key] ?? story[key];
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="storyId" value={story.id} />
      <TextField name="title" label="Título" required maxLength={120} defaultValue={v("title")} error={errors.title} />
      <TextField name="era" label="Época (opcional)" maxLength={40} defaultValue={v("era")} hint="Exemplo: 2009, ou calourada de 2010." error={errors.era} />
      <TextareaField name="body" label="A história" rows={10} required defaultValue={v("body")} error={errors.body} />
      <p className="text-sm text-sepia-escuro">
        Só integrantes leem. Evite expor dados de terceiros (telefone, endereço, fotos de quem não quer aparecer).
      </p>
      <div>
        <SubmitButton pendingLabel="Salvando…">{story.id ? "Salvar história" : "Publicar história"}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteStoryForm({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteStory, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" pendingLabel="Apagando…">
        Apagar história
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function StoryPhotoForm({ storyId }: { storyId: string }) {
  const [state, formAction] = useActionState(addStoryPhoto, initialFormState);
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
      <input type="hidden" name="storyId" value={storyId} />
      <label className="flex flex-col gap-1 font-semibold">
        Anexar foto (até 4)
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required onChange={onChange} className="font-normal" />
      </label>
      <div>
        <SubmitButton variant="outline" pendingLabel="Enviando…">
          Enviar foto
        </SubmitButton>
      </div>
    </form>
  );
}

export function RemovePhotoForm({ storyId, photoId }: { storyId: string; photoId: string }) {
  const [state, formAction] = useActionState(removeStoryPhoto, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="photoId" value={photoId} />
      <SubmitButton variant="outline" pendingLabel="Removendo…">
        Remover foto
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function AddCommentForm({ storyId }: { storyId: string }) {
  const [state, formAction] = useActionState(addComment, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {state.message && state.status === "error" ? <Notice tone="error">{state.message}</Notice> : null}
      <input type="hidden" name="storyId" value={storyId} />
      <TextareaField name="body" label="Comentar" rows={2} required maxLength={500} error={state.fieldErrors?.body} />
      <div>
        <SubmitButton pendingLabel="Enviando…">Comentar</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteCommentForm({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteComment, initialFormState);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" pendingLabel="Apagando…">
        Apagar
      </SubmitButton>
      {state.status === "error" ? <span className="ml-2 text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function HideStoryForm({ storyId, hidden }: { storyId: string; hidden: boolean }) {
  const [state, formAction] = useActionState(setStoryHidden, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
      {!hidden ? <TextField name="reason" label="Motivo (visível ao autor)" maxLength={200} error={state.fieldErrors?.reason} /> : null}
      <div>
        <SubmitButton variant="outline" pendingLabel="Salvando…">
          {hidden ? "Reexibir história" : "Ocultar história"}
        </SubmitButton>
      </div>
    </form>
  );
}
