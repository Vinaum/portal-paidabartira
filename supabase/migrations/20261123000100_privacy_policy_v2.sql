-- Segunda versão da política de privacidade: passa a descrever aniversário,
-- histórias, comentários, loja, caixinha, agenda e a lista pública de pessoas.
-- Aplique esta migration antes de publicar o código: o pedido de acesso grava
-- a versão aceita e depende de ela existir.
insert into public.privacy_policy_versions (version, summary)
values (
  '2026-11-13',
  'Inclui aniversário (dia e mês), histórias e comentários, pedidos da loja, caixinha, agenda e a lista pública de pessoas; detalha o que acontece com cada dado ao excluir a conta.'
)
on conflict (version) do nothing;
