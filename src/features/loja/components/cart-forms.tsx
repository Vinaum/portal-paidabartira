"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState, type FormState } from "@/lib/form";

import { addToCart, checkout, removeCartLine, saveShopPix, updateCartLine } from "../actions";

export function AddToCartForm({ productId, sizes }: { productId: string; sizes: string[] }) {
  const [state, formAction] = useActionState(addToCart, initialFormState);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success" && state.data?.href) router.push(state.data.href);
  }, [state, router]);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <input type="hidden" name="productId" value={productId} />
      {sizes.length > 0 ? (
        <SelectField name="size" label="Tamanho" required defaultValue={values.size ?? ""} error={errors.size}>
          <option value="">Escolha…</option>
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="size" value="" />
      )}
      <TextField name="quantity" type="number" min={1} max={20} label="Quantidade" required defaultValue={values.quantity ?? "1"} error={errors.quantity} />
      <div>
        <SubmitButton pendingLabel="Adicionando…">Adicionar ao carrinho</SubmitButton>
      </div>
    </form>
  );
}

export function CartQuantityForm({ productId, size, quantity }: { productId: string; size: string; quantity: number }) {
  const [state, formAction] = useActionState(updateCartLine, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="size" value={size} />
      <label className="flex flex-col text-sm font-semibold">
        Qtd.
        <input name="quantity" type="number" min={1} max={20} defaultValue={quantity} className="w-20 rounded-sm border-2 border-preto bg-white px-2 py-1 font-normal" />
      </label>
      {state.fieldErrors?.quantity ? <span className="text-sm font-semibold text-vinho">{state.fieldErrors.quantity}</span> : null}
      <SubmitButton variant="outline" pendingLabel="…">
        Atualizar
      </SubmitButton>
    </form>
  );
}

export function RemoveCartLineForm({ productId, size }: { productId: string; size: string }) {
  const [state, formAction] = useActionState(removeCartLine, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="size" value={size} />
      <SubmitButton variant="outline" pendingLabel="Removendo…">
        Remover
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(initialFormState);

  // O envio é feito à mão: ao limpar o cookie do carrinho a página se atualiza e esvazia, e um
  // formulário com useActionState sumiria antes de conseguir navegar para o pedido.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await checkout(initialFormState, formData);
      setState(result);
      if (result.status === "success" && result.data?.href) {
        router.push(result.data.href);
        router.refresh(); // o contador do carrinho no cabeçalho volta a zero
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextareaField name="note" label="Observação para a tesouraria (opcional)" rows={2} maxLength={300} defaultValue={state.values?.note ?? ""} error={state.fieldErrors?.note} />
      <p className="text-sm text-sepia-escuro">Não escreva dados pessoais na observação.</p>
      <div>
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? "Finalizando…" : "Finalizar pedido e pagar com PIX"}
        </Button>
      </div>
    </form>
  );
}

export function ShopPixForm({ current }: { current: { key: string; receiver: string; city: string } | null }) {
  const [state, formAction] = useActionState(saveShopPix, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = (name: "pixKey" | "receiver" | "city", fallback: string) => state.values?.[name] ?? fallback;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <TextField name="pixKey" label="Chave PIX" defaultValue={v("pixKey", current?.key ?? "")} hint="E-mail, celular com +55, CPF, CNPJ ou chave aleatória. Em branco desliga o QR code." error={errors.pixKey} />
      <TextField name="receiver" label="Nome do recebedor (até 25 letras)" defaultValue={v("receiver", current?.receiver ?? "")} error={errors.receiver} />
      <TextField name="city" label="Cidade (até 15 letras)" defaultValue={v("city", current?.city ?? "")} error={errors.city} />
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar PIX da loja</SubmitButton>
      </div>
    </form>
  );
}
