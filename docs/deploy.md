# Guia de deploy

## 1. GitHub

```bash
git remote add origin git@github.com:Vinaum/portal-paidabartira.git
git push -u origin main
```

O workflow `.github/workflows/ci.yml` roda a cada push e pull request: lint, tipos,
testes unitários, build e os testes de RLS no Supabase local.

## 2. Vercel

1. <https://vercel.com/new> > importar o repositório.
2. Framework: Next.js (detectado). Sem ajustes de build.
3. Em **Environment Variables**, cadastre as três variáveis de `.env.example` para
   Production. Para Preview, use as chaves do projeto Supabase de homologação, nunca as
   de produção.
4. Deploy. O endereço gratuito será `https://NOME-DO-PROJETO.vercel.app`.
5. Copie esse endereço para **Site URL** e **Redirect URLs** no Supabase
   (`docs/supabase.md`, passo 3).

## 3. Limites do plano Hobby

- Uso pessoal e não comercial. Pedir doações é permitido; anunciar venda de produtos
  não. **A Loja (Etapa 4) depende de decisão sobre a hospedagem.**
- Um único usuário na conta. Use um e-mail da república, não pessoal.
- Sem garantia de disponibilidade.

## 4. Depois de cada deploy

- Abrir `/` e `/login`.
- Tentar `/painel` sem sessão: deve redirecionar para `/login`.
- Entrar com uma conta de teste e sair.
