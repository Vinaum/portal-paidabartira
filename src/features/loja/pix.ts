/**
 * PIX "copia e cola" (BR Code estático, padrão EMV do Banco Central).
 * Não fala com banco nenhum: só monta o texto que o app do banco lê no QR code.
 * Não há retorno de pagamento; quem gerencia a loja confere o PIX recebido.
 */

/** CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), em hexadecimal maiúsculo com 4 dígitos. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Nome e cidade do PIX: ASCII, maiúsculas, sem acento nem símbolos. */
export function normalizePixText(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RANDOM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chave PIX aceita: e-mail, chave aleatória, celular com +55, CPF (11 dígitos) ou CNPJ (14).
 * Devolve a chave limpa ou null se o formato não for reconhecido.
 */
export function normalizePixKey(input: string): string | null {
  const key = input.trim();
  if (key.length === 0 || key.length > 77) return null;
  if (EMAIL.test(key)) return key.toLowerCase();
  if (RANDOM_KEY.test(key)) return key.toLowerCase();
  if (key.startsWith("+")) {
    const phone = `+${key.slice(1).replace(/\D/g, "")}`;
    return /^\+55\d{10,11}$/.test(phone) ? phone : null;
  }
  const digits = key.replace(/[.\-/\s]/g, "");
  return /^\d{11}$/.test(digits) || /^\d{14}$/.test(digits) ? digits : null;
}

export type PixInput = {
  key: string;
  receiver: string;
  city: string;
  amountCents: number;
  /** Código do pedido (letras e números, até 25). */
  txid: string;
};

export function buildPixPayload({ key, receiver, city, amountCents, txid }: PixInput): string {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Valor do PIX inválido");
  const amount = `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`;
  const cleanTxid = txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body =
    field("00", "01") +
    field("01", "11") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", key)) +
    field("52", "0000") +
    field("53", "986") +
    field("54", amount) +
    field("58", "BR") +
    field("59", normalizePixText(receiver, 25) || "LOJA") +
    field("60", normalizePixText(city, 15) || "BRASIL") +
    field("62", field("05", cleanTxid));
  const withCrcHeader = `${body}6304`;
  return `${withCrcHeader}${crc16(withCrcHeader)}`;
}

/** Código curto do pedido, usado como identificador no PIX e na tela. */
export function orderCode(orderId: string): string {
  return `PDB${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
