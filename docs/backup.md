# Backup e recuperação

## Riscos do plano gratuito do Supabase

- **Sem backup automático.**
- O projeto é **pausado após 1 semana sem tráfego**.
- Banco limitado a 500 MB e arquivos a 1 GB.

Nada disso é garantido pelo fornecedor e os limites podem mudar. Confira
<https://supabase.com/pricing> periodicamente.

## Situação atual (Etapa 2)

A rotina automática de backup **ainda não está implementada**. Ela entra na Etapa 5,
como workflow agendado do GitHub Actions (dump diário criptografado + cópia semanal dos
arquivos), com ensaio de restauração. Até lá, antes de cadastrar dados reais, faça
backup manual.

## Backup manual

A string de conexão está em **Project Settings > Database > Connection string**.

```bash
pg_dump "postgresql://postgres:SENHA@db.SEU_REF.supabase.co:5432/postgres" \
  --schema=public --schema=auth --schema=storage \
  --format=custom --file="paidabartira-$(date +%F).dump"
```

O arquivo contém dados pessoais. Guarde-o criptografado e fora do repositório.

## Restauração

1. Crie um projeto Supabase novo.
2. `pg_restore --clean --if-exists --no-owner -d "STRING_DO_PROJETO_NOVO" arquivo.dump`
3. Atualize as variáveis de ambiente na Vercel e faça novo deploy.
4. Reenvie os arquivos do Storage, se houver cópia.

## Projeto pausado

No painel do Supabase, **Restore project**. Os dados são mantidos por um período após a
pausa; não conte com isso como backup.
