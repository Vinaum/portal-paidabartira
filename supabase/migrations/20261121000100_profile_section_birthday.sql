-- Nova seção de privacidade: aniversário. O valor novo só pode ser usado depois
-- que esta transação termina, então o uso fica na migration seguinte.
alter type public.profile_section add value if not exists 'birthday';
