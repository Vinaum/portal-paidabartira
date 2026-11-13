"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { saveProduct, saveProductPhoto } from "../actions";
import { PRODUCT_VISIBILITIES, PRODUCT_VISIBILITY_LABELS } from "../schemas";

export type ProductFormValues = {
  id: string;
  name: string;
  description: string;
  price: string;
  visibility: (typeof PRODUCT_VISIBILITIES)[number];
  sizes: string;
  paymentInstructions: string;
  isPublished: boolean;
  isAvailable: boolean;
};

const EMPTY: ProductFormValues = {
  id: "",
  name: "",
  description: "",
  price: "",
  visibility: "members",
  sizes: "",
  paymentInstructions: "",
  isPublished: false,
  isAvailable: true,
};

export function ProductForm({ product = EMPTY }: { product?: ProductFormValues }) {
  const [state, formAction] = useActionState(saveProduct, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = (key: Exclude<keyof ProductFormValues, "isPublished" | "isAvailable">) => state.values?.[key] ?? product[key];
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="productId" value={product.id} />
      <TextField name="name" label="Nome" required maxLength={80} defaultValue={v("name")} error={errors.name} />
      <TextareaField name="description" label="Descrição (opcional)" rows={4} defaultValue={v("description")} error={errors.description} />
      <TextField name="price" label="Preço (R$)" inputMode="decimal" required defaultValue={v("price")} hint="Exemplo: 45,00" error={errors.price} />
      <SelectField name="visibility" label="Quem vê este produto" defaultValue={v("visibility")} error={errors.visibility}>
        {PRODUCT_VISIBILITIES.map((option) => (
          <option key={option} value={option}>
            {PRODUCT_VISIBILITY_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <TextField name="sizes" label="Tamanhos (opcional)" defaultValue={v("sizes")} hint="Separe por vírgula. Exemplo: P, M, G, GG. Deixe vazio se não houver." error={errors.sizes} />
      <TextareaField
        name="paymentInstructions"
        label="Como pagar (opcional)"
        rows={2}
        defaultValue={v("paymentInstructions")}
        hint="Quem faz o pedido recebe este texto. Ex.: chave PIX e prazo."
        error={errors.paymentInstructions}
      />
      <CheckboxField name="isPublished" defaultChecked={product.isPublished}>
        Publicado (aparece na loja). Desmarque para manter como rascunho.
      </CheckboxField>
      <CheckboxField name="isAvailable" defaultChecked={product.isAvailable}>
        Disponível. Desmarque para marcar como esgotado.
      </CheckboxField>
      <div>
        <SubmitButton pendingLabel="Salvando…">{product.id ? "Salvar produto" : "Criar produto"}</SubmitButton>
      </div>
    </form>
  );
}

/** Reduz no navegador antes do envio; o servidor decide o que aceita. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
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

export function ProductPhotoForm({ productId }: { productId: string }) {
  const [state, formAction] = useActionState(saveProductPhoto, initialFormState);
  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(await shrink(file));
    event.target.files = transfer.files;
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="productId" value={productId} />
      <label className="flex flex-col gap-1 font-semibold">
        Foto do produto
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
