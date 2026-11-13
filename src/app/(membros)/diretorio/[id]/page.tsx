import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Seal } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { MemberPhoto } from "@/features/diretorio/components/member-photo";
import { getMemberProfile } from "@/features/diretorio/queries";
import { COMPLETION_LABELS, SOCIAL_NETWORKS } from "@/features/perfis/schemas";
import { requireActiveMember } from "@/lib/auth/session";
import { formatPeriod } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Integrante" };

const networkLabel = (network: string) =>
  network === "other" ? "Outro link" : (SOCIAL_NETWORKS[network as keyof typeof SOCIAL_NETWORKS]?.label ?? network);

export default async function MemberProfilePage({ params }: PageProps<"/diretorio/[id]">) {
  const viewer = await requireActiveMember();
  const { id } = await params;
  const member = await getMemberProfile(id);
  if (!member) notFound();

  const contact = [
    member.officialEmail ? ["E-mail", member.officialEmail] : null,
    member.phone?.phone ? ["Telefone", member.phone.phone] : null,
    member.phone?.whatsapp ? ["WhatsApp", member.phone.whatsapp] : null,
    member.address ? ["Endereço", member.address] : null,
  ].filter((row): row is string[] => row !== null);

  const work = member.professional;
  const hasWork = work && (work.company || work.job_title || work.field || work.pitch || work.skills.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <p>
        <Link href="/diretorio" className="font-semibold underline">
          ← Diretório
        </Link>
      </p>

      <div className="flex flex-wrap items-start gap-6">
        <MemberPhoto url={member.photoUrl} name={member.displayName} size={144} />
        <div className="flex flex-col gap-2">
          <SectionHeading as="h1" kicker="Integrante" title={member.displayName} />
          <p className="text-sepia-escuro">
            {member.fullName}
            {member.nickname && member.nickname !== member.displayName ? ` · “${member.nickname}”` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Seal>{CATEGORY_LABELS[member.category]}</Seal>
            {member.isFounder ? <Seal tone="vinho">Fundador</Seal> : null}
          </div>
          {member.id === viewer.id ? (
            <p>
              <Link href="/perfil" className="font-semibold underline">
                Editar meu perfil
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {member.bio ? (
        <Card>
          <p className="whitespace-pre-line">{member.bio}</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Na república</h2>
        {member.periods.length === 0 ? (
          <p>Períodos não informados.</p>
        ) : (
          <ul className="list-disc pl-5">
            {member.periods.map((period) => (
              <li key={period.id} className="first-letter:uppercase">
                {formatPeriod(period.started_on, period.ended_on)}
              </li>
            ))}
          </ul>
        )}
        {member.origin || member.current ? (
          <dl className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            {member.origin ? (
              <>
                <dt className="font-semibold">Origem</dt>
                <dd>{member.origin}</dd>
              </>
            ) : null}
            {member.current ? (
              <>
                <dt className="font-semibold">Hoje</dt>
                <dd>{member.current}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </Card>

      {member.education.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Formação</h2>
          <ul className="flex flex-col gap-2">
            {member.education.map((item) => (
              <li key={item.id}>
                <strong>{item.course}</strong> · {item.institution}
                <span className="block text-sm text-sepia-escuro">
                  {[item.start_year, item.end_year].filter(Boolean).join("–")}
                  {item.start_year || item.end_year ? " · " : ""}
                  {COMPLETION_LABELS[item.completion]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {hasWork ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Profissional</h2>
          <p>{[work.job_title, work.company].filter(Boolean).join(" · ")}</p>
          {work.field ? <p className="text-sepia-escuro">{work.field}</p> : null}
          {work.pitch ? <p className="whitespace-pre-line">{work.pitch}</p> : null}
          {work.skills.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {work.skills.map((skill) => (
                <li key={skill}>
                  <Seal tone="preto">{skill}</Seal>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {contact.length > 0 || member.social.length > 0 || work?.website_url ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Contato e redes</h2>
          {contact.length > 0 ? (
            <dl className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              {contact.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-semibold">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {[...member.social, ...(work?.website_url ? [{ network: "site", url: work.website_url }] : [])].map(
              (link) => (
                <li key={`${link.network}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-semibold underline"
                  >
                    {link.network === "site" ? "Site" : networkLabel(link.network)}
                  </a>
                </li>
              ),
            )}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
