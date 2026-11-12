import type { Metadata } from "next";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { placeholder, site } from "@/config/site";
import { POLICY_VERSION } from "@/features/acesso/schemas";

export const metadata: Metadata = { title: "Política de privacidade" };

const CONTROLLER_NAME = "Vinicius Sartori";

/**
 * MINUTA da política de privacidade (versão registrada em
 * privacy_policy_versions). O texto descreve o que o portal faz hoje; revise
 * com alguém da área jurídica antes de abrir o portal a mais pessoas, e
 * publique nova versão sempre que o tratamento de dados mudar.
 */
export default function PrivacyPage() {
  const contact = site.contactEmail ?? placeholder("E-mail de contato");
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <SectionHeading as="h1" kicker={`Versão ${POLICY_VERSION}`} title="Política de privacidade" />
      <Notice>
        Esta é uma primeira versão, escrita para explicar com clareza o que o portal faz com os dados.
        Ainda não passou por revisão jurídica.
      </Notice>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Quem responde pelos dados</h2>
        <p>
          O portal é mantido pela república {site.name}. O responsável pelo tratamento dos dados é{" "}
          {CONTROLLER_NAME}. Contato: {contact}.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Que dados coletamos e para quê</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Pedido de acesso:</strong> nome, apelido, e-mail, telefone (opcional), relação com a
            república e o que você escrever sobre o seu vínculo. Servem só para a administração decidir
            sobre o pedido.
          </li>
          <li>
            <strong>Conta:</strong> e-mail de login e senha. A senha é guardada de forma cifrada pelo
            serviço de autenticação; ninguém da república consegue lê-la.
          </li>
          <li>
            <strong>Perfil:</strong> o que você decidir preencher (foto, contatos, formação, profissão).
            Nenhum desses campos é obrigatório.
          </li>
          <li>
            <strong>Registros de administração:</strong> aprovações, convites e alterações de permissão
            ficam registrados para auditoria.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Quem vê os seus dados</h2>
        <p>
          Cada parte do perfil tem um nível de visibilidade que você escolhe: público, somente membros ou
          privado. Telefone e endereço começam como privados. O que está como privado não é visto por
          outros integrantes nem pelos administradores. Você só aparece na parte pública do portal se
          autorizar.
        </p>
        <p>Os dados do pedido de acesso são vistos apenas por quem analisa solicitações.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Onde os dados ficam</h2>
        <p>
          O banco de dados e os arquivos ficam no Supabase, em servidores na região de São Paulo. O site
          é servido pela Vercel. Não vendemos nem compartilhamos dados com terceiros para publicidade, e
          o portal não usa cookies de rastreamento: os únicos cookies são os da sua sessão de login.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Seus direitos</h2>
        <p>
          Você pode ver e corrigir seus dados no próprio perfil, pedir uma cópia, pedir a correção do que
          não consegue alterar sozinho e pedir a exclusão da conta. Enquanto a página de pedidos não
          estiver disponível na área de integrantes, faça o pedido pelo contato acima.
        </p>
        <p>
          Pedidos de acesso rejeitados e dados de contas excluídas são apagados ou anonimizados. Registros
          de auditoria e lançamentos financeiros são mantidos sem dados pessoais desnecessários.
        </p>
      </section>

      <p className="rotulo text-sepia-escuro">Versão {POLICY_VERSION}</p>
    </article>
  );
}
