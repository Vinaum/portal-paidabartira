-- Quarta versão da política: carrinho da loja (cookie) e QR code do PIX.
insert into public.privacy_policy_versions (version, summary)
values ('2026-11-14.2', 'Informa o cookie do carrinho da loja e o QR code do PIX; pagamento continua fora do portal, com conferência manual.')
on conflict (version) do nothing;
