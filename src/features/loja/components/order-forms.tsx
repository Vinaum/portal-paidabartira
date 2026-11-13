"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { cancelOrder, requestOrder, setOrderStatus } from "../actions";
import { NEXT_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "../schemas";

export function OrderForm({ productId, sizes }: { productId: string; sizes: string[] }) {
  const [state, formAction] = useActionState(requestOrder, initialFormState);
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
      <TextareaField name="note" label="Observação (opcional)" rows={2} defaultValue={values.note ?? ""} error={errors.note} />
      <div>
        <SubmitButton pendingLabel="Enviando pedido…">Pedir</SubmitButton>
      </div>
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(cancelOrder, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton variant="outline" pendingLabel="Cancelando…">
        Cancelar pedido
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

export function OrderStatusForm({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, formAction] = useActionState(setOrderStatus, initialFormState);
  const options = NEXT_STATUSES[status];
  if (options.length === 0) return null;
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField name="status" label="Mudar para" defaultValue={options[0]}>
        {options.map((option) => (
          <option key={option} value={option}>
            {ORDER_STATUS_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <TextField name="note" label="Recado ao integrante (opcional)" maxLength={200} error={state.fieldErrors?.note} />
      <SubmitButton variant="outline" pendingLabel="Salvando…">
        Atualizar
      </SubmitButton>
    </form>
  );
}
