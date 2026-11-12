import { signOut } from "../actions";
import { SubmitButton } from "./submit-button";

export function SignOutButton({ variant = "outline" }: { variant?: "dark" | "outline" }) {
  return (
    <form action={signOut}>
      <SubmitButton variant={variant} pendingLabel="Saindo…">
        Sair
      </SubmitButton>
    </form>
  );
}
