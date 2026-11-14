import type { Metadata } from "next";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { site } from "@/config/site";
import { ContactEmail } from "@/features/portal/components/home-sections";
import { POLICY_VERSION } from "@/features/acesso/schemas";

export const metadata: Metadata = { title: "Política de privacidade" };

const CONTROLLER_NAME = "Vinicius Sartori";

/**
 * MINUTA da política de privacidade (versão registrada em
 * privacy_policy_versions). O texto descreve o que o portal faz hoje; revise
 * com alguém da área jurídica antes de abrir o portal a mais pessoas.
 * Sempre que o tratamento de dados mudar: atualize este texto, crie uma nova
 * versão em `POLICY_VERSION` e uma migration que a registre.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <SectionHeading as="h1" kicker={`Versão ${POLICY_VERSION}`} title="Política de privacidade" />
      <Notice>
        Este texto explica, com clareza, o que o portal faz com os dados. Ainda não passou por revisão jurídica.
      </Notice>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">O que mudou nesta versão</h2>
        <p>
          A versão anterior descrevia só o pedido de acesso e o perfil. Esta passa a cobrir também aniversário,
          histórias e comentários, agenda, loja, caixinha e a lista pública de pessoas, e explica o que acontece
          com cada dado quando uma conta é excluída.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Quem responde pelos dados</h2>
        <p>
          O portal é mantido pela república {site.name}. O responsável pelo tratamento dos dados é{" "}
          {CONTROLLER_NAME}. Contato:{" "}
          <Suspense fallback="…">
            <ContactEmail />
          </Suspense>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Que dados coletamos e para quê</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Pedido de acesso:</strong> nome, apelido, e-mail, telefone (opcional), relação com a república
            e o que você escrever sobre o seu vínculo. Servem só para a administração decidir sobre o pedido.
          </li>
          <li>
            <strong>Conta:</strong> e-mail de login e senha. A senha é guardada de forma cifrada pelo serviço de
            autenticação; ninguém da república consegue lê-la.
          </li>
          <li>
            <strong>Perfil (tudo opcional, exceto o nome):</strong> nome de exibição, apelido, apresentação, cidade
            de origem e atual, foto, e-mail oficial, telefone e WhatsApp, endereço, redes sociais, formação,
            trabalho e os períodos em que você morou na casa.
          </li>
          <li>
            <strong>Aniversário:</strong> só dia e mês, <em>nunca o ano</em>, para que não dê para calcular a
            idade. Serve para mostrar aniversariantes na agenda e no painel.
          </li>
          <li>
            <strong>Histórias e comentários:</strong> o texto e até 4 fotos por história, e os comentários que você
            escrever. O seu nome de exibição aparece junto como autor.
          </li>
          <li>
            <strong>Agenda:</strong> a sua resposta (vou, talvez, não vou) aos eventos.
          </li>
          <li>
            <strong>Loja:</strong> os pedidos que você fizer (produto, quantidade, tamanho, observação e andamento).
            O pagamento é combinado fora do portal; não guardamos dados de cartão nem de conta bancária.
          </li>
          <li>
            <strong>Caixinha:</strong> o portal <em>não registra quem contribuiu</em>. Os lançamentos têm valor,
            data, categoria e uma descrição escrita por quem lança. Pedimos que ninguém escreva nomes de quem
            contribuiu; mesmo assim, a descrição de uma entrada só é vista por quem gerencia a caixinha.
          </li>
          <li>
            <strong>Fotos enviadas:</strong> o servidor regrava cada imagem e descarta os metadados, inclusive a
            localização (GPS), antes de guardá-la.
          </li>
          <li>
            <strong>Registros de administração:</strong> aprovações, convites, mudanças de permissão, moderação e
            outras ações ficam registrados para auditoria, com o identificador interno de quem agiu e sem o texto
            do que você escreveu.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Quem vê os seus dados</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Perfil:</strong> cada parte (foto, e-mail, telefone, endereço, trabalho, formação, redes,
            aniversário) tem um nível que você escolhe: público, só integrantes ou privado. Enquanto você não escolher,
            a parte fica privada. O que está privado não é visto por outros integrantes nem pelos administradores.
          </li>
          <li>
            <strong>Período na casa:</strong> visível só a integrantes, nunca ao público.
          </li>
          <li>
            <strong>Histórias, comentários e agenda:</strong> só integrantes ativos. A moderação pode ocultar uma
            história; ela segue visível para quem a escreveu.
          </li>
          <li>
            <strong>Aniversário:</strong> aparece na agenda dos integrantes só se a seção estiver visível para
            integrantes. Nunca aparece no portal público.
          </li>
          <li>
            <strong>Loja:</strong> os seus pedidos são vistos por você e pelos responsáveis pela loja (nome, produto,
            quantidade, observação e andamento).
          </li>
          <li>
            <strong>Caixinha:</strong> integrantes veem totais, saldo, o fluxo por mês e cada saída. Visitantes veem
            só o total arrecadado das caixinhas públicas.
          </li>
          <li>
            <strong>Portal público:</strong> você só aparece se marcar que autoriza. Aparecem apenas nome de
            exibição, apelido, apresentação, se é morador atual, ex-morador ou fundador, e a foto (se a foto estiver
            pública). Pessoas com a categoria agregado não aparecem. O portal também mostra números gerais (quantas
            pessoas moram, já moraram, fundadores), sem identificar ninguém. Você pode retirar a autorização a
            qualquer momento no perfil.
          </li>
          <li>
            <strong>Pedido de acesso:</strong> visto apenas por quem analisa solicitações.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Onde os dados ficam</h2>
        <p>
          O banco de dados e os arquivos ficam no Supabase, em servidores na região de São Paulo. O site é servido
          pela Vercel. Não vendemos nem compartilhamos dados com terceiros para publicidade, e o portal não usa
          cookies de rastreamento: os únicos cookies são os da sua sessão de login.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Por quanto tempo e o que acontece ao excluir a conta</h2>
        <p>
          Guardamos os dados enquanto a sua conta existir. Quando você pede a exclusão e a administração a executa,
          a exclusão é definitiva e apaga:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>o perfil e tudo que está nele, incluindo foto, contatos, endereço, redes e aniversário;</li>
          <li>as suas histórias, as fotos delas e os seus comentários;</li>
          <li>as suas respostas a eventos e a sua designação como responsável de caixinha ou da loja, se houver;</li>
          <li>os dados do pedido de acesso (nome, e-mail e telefone).</li>
        </ul>
        <p>Algumas informações permanecem, sem ligação com a sua pessoa:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Pedidos da loja:</strong> ficam como registro da venda, sem o vínculo com a sua conta. O texto
            de observação do pedido, se você escreveu algum, pode permanecer; por isso, não coloque dados pessoais
            nele.
          </li>
          <li>
            <strong>Lançamentos da caixinha:</strong> são um livro-caixa que não pode ser alterado. Continuam, sem
            identificar quem os registrou.
          </li>
          <li>
            <strong>Registros de auditoria:</strong> guardam apenas um identificador interno, que deixa de apontar
            para uma pessoa.
          </li>
        </ul>
        <p>Pedidos de acesso rejeitados ficam guardados com a decisão da administração, para registro.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Seus direitos</h2>
        <p>
          Pela Lei Geral de Proteção de Dados (LGPD), você pode confirmar que tratamos dados seus, acessá-los,
          corrigi-los, pedir a eliminação ou a anonimização, pedir uma cópia, saber com quem os compartilhamos e
          retirar a autorização que deu. Na prática:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>ver e corrigir o que você preencheu: no próprio perfil, quando quiser;</li>
          <li>pedir a exclusão da conta: no fim da página do perfil; a administração analisa e executa;</li>
          <li>pedir uma cópia dos dados ou a correção do que você não consegue alterar sozinho: pelo contato acima.</li>
        </ul>
        <p>
          Se achar que seus dados não foram tratados como deveriam, você também pode recorrer à Autoridade Nacional
          de Proteção de Dados (ANPD).
        </p>
      </section>

      <p className="rotulo text-sepia-escuro">Versão {POLICY_VERSION} · 13 de novembro de 2026</p>
    </article>
  );
}
