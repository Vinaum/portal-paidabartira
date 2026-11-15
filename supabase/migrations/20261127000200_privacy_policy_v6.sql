-- Sexta versão da política: vagas para novos moradores (dados de candidatos, guardados por até 90 dias).
insert into public.privacy_policy_versions (version, summary)
values ('2026-11-15.2', 'Inclui as vagas para novos moradores: dados de quem demonstra interesse (nome, e-mail, telefone, curso e mensagem), guardados por até 90 dias.')
on conflict (version) do nothing;
