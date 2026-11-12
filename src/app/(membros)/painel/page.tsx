import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireActiveMember } from "@/lib/auth/session";
import { CATEGORY_LABELS, ROLE_LABELS, canAccessAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Painel" };

/**
 * Painel da Etapa 2: confirma a identidade e o vínculo lidos do banco.
 * Eventos, comunicados, histórias e caixinha entram com seus módulos.
 */
export default async function DashboardPage() {
  const member = await requireActiveMember();

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Boas-vindas" title={`Olá, ${member.displayName}`} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Seu vínculo</h2>
        <div className="flex flex-wrap gap-2">
          <Seal>{CATEGORY_LABELS[member.category]}</Seal>
          {member.isFounder ? <Seal tone="vinho">Fundador</Seal> : null}
          {member.role !== "membro" ? <Seal tone="preto">{ROLE_LABELS[member.role]}</Seal> : null}
        </div>
        <p>
          E-mail de login: <strong>{member.email ?? "não informado"}</strong>
        </p>
        {canAccessAdmin(member.permissions) ? (
          <div>
            <ButtonLink href="/admin" variant="dark">
              Abrir administração
            </ButtonLink>
          </div>
        ) : null}
      </Card>

      <Notice>
        Diretório, eventos, edição de perfil e caixinha chegam na próxima etapa do portal.
      </Notice>
    </div>
  );
}
