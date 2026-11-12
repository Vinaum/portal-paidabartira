-- Fecha a execução de funções e reabre só o necessário.
-- No Postgres toda função nasce executável por PUBLIC, e o Supabase ainda
-- concede EXECUTE a anon/authenticated no esquema public. Por isso:
--   1. revoga-se tudo nos esquemas public e private;
--   2. concede-se, por nome, o que cada papel realmente precisa.
-- CONVENÇÃO: toda migration futura que criar funções termina repetindo este
-- padrão para as funções que criou (revoke + grant explícito).

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Funções consultadas pelas políticas de RLS (somente leitura de autorização).
grant execute on function
  private.is_active_member(),
  private.member_is_active(uuid),
  private.current_member_role(),
  private.is_superadmin(),
  private.has_permission(text),
  private.can_assign_role(public.member_role),
  private.can_view_section(uuid, public.profile_section),
  private.try_uuid(text)
to anon, authenticated;

-- RPCs da aplicação: exigem sessão. Cada uma confere a permissão internamente.
grant execute on function
  public.my_permissions(),
  public.activate_membership(),
  public.admin_review_request(uuid, text, public.member_category, boolean, public.member_role, text, text),
  public.admin_register_invitation(uuid, uuid),
  public.admin_set_member_role(uuid, public.member_role, text),
  public.admin_update_member(uuid, public.member_category, boolean, public.member_status, date, date, text)
to authenticated;

grant execute on all functions in schema private to service_role;
grant execute on all functions in schema public to service_role;
