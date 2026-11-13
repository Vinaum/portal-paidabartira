-- Nova seção de privacidade: redes sociais.
-- Fica em uma migration separada porque um valor novo de enum só pode ser
-- usado depois que a transação que o criou termina.
alter type public.profile_section add value if not exists 'social';
