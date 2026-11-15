-- Quinta versão da política: Associação (adesão, mensalidades por PIX, livro-caixa e documentos).
insert into public.privacy_policy_versions (version, summary)
values ('2026-11-15', 'Inclui a Associação: pedido de adesão, mensalidades informadas por PIX com conferência manual, livro-caixa sem nomes e documentos em PDF.')
on conflict (version) do nothing;
