"use client";

import { useActionState } from "react";

import { SelectField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { cancelOrder, setOrderStatus } from "../actions";
import { NEXT_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "../schemas";

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
