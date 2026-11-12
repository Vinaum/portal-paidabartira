-- Privilégios explícitos: fecha os GRANTs padrão do Supabase.
--
-- PROBLEMA CORRIGIDO: em um projeto Supabase, toda tabela criada em `public`
-- nasce com ALL concedido a anon e authenticated (privilégios padrão da
-- plataforma). As migrations anteriores listavam só os GRANTs desejados, mas
-- não revogavam os padrão. A RLS continuava barrando LINHAS, porém as
-- restrições por COLUNA não valiam: um visitante poderia enviar uma
-- solicitação já com `assigned_role` preenchido, ou ler colunas de perfil que
-- não deveriam ser públicas.
--
-- A partir daqui a regra é "negar por padrão" também nos GRANTs:
--   1. novos objetos de `public` não recebem privilégio algum automaticamente;
--   2. tudo é revogado de anon/authenticated;
--   3. cada privilégio necessário é concedido por nome.
-- CONVENÇÃO: toda migration que criar tabela concede explicitamente o que
-- anon/authenticated precisam (além de ligar a RLS e criar as políticas).

-- 1. Futuros objetos criados por este papel (o mesmo que roda as migrations).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- 2. Objetos já existentes.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 3. Concessões explícitas (as linhas continuam filtradas pela RLS).

-- Identidade e permissões
grant select on public.members to authenticated;
grant select on public.permissions, public.role_permissions to authenticated;
grant insert, delete on public.role_permissions to authenticated;
grant select on public.membership_history to authenticated;
grant select on public.audit_logs to authenticated;

-- Entrada: o visitante só envia os campos do formulário.
grant insert (full_name, nickname, email, phone, relationship, justification, extra_info, policy_version)
  on public.membership_requests to anon, authenticated;
grant select on public.membership_requests to authenticated;
grant select on public.invitations to authenticated;

-- Perfis: o anônimo só enxerga as colunas de apresentação.
grant select (member_id, display_name, nickname, bio) on public.profiles to anon;
grant select, update on public.profiles to authenticated;
grant select, update on public.profile_privacy to authenticated;

grant select on
  public.profile_photo, public.profile_emails, public.profile_phone,
  public.profile_address, public.profile_professional, public.education
to anon;
grant select, insert, update, delete on
  public.profile_photo, public.profile_emails, public.profile_phone,
  public.profile_address, public.profile_professional, public.education
to authenticated;

-- Plataforma e LGPD
grant select on public.republic_settings to anon, authenticated;
grant insert, update on public.republic_settings to authenticated;
grant select on public.privacy_policy_versions to anon, authenticated;
grant select on public.consents to authenticated;
grant select on public.data_requests to authenticated;
grant insert (member_id, kind, details) on public.data_requests to authenticated;
grant update (status, resolution, handled_by, handled_at) on public.data_requests to authenticated;
