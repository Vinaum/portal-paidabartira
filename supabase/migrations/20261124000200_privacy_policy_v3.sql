-- Terceira versão da política: inclui o Museu (álbuns de fotos).
insert into public.privacy_policy_versions (version, summary)
values ('2026-11-14', 'Inclui o Museu (álbuns de fotos públicos ou internos, sem marcação de pessoas) e o que acontece com as fotos ao excluir a conta.')
on conflict (version) do nothing;
