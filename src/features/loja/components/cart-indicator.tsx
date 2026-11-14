import { readCart } from "../cart";
import { cartItemCount } from "../cart-lines";

import { CartIcon, CartLink } from "./cart-icon";

export { CartIcon };

/** Ícone do carrinho com contador, lido do cookie no servidor (áreas restritas). */
export async function CartIndicator() {
  return <CartLink count={cartItemCount(await readCart())} />;
}
