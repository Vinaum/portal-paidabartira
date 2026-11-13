import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  addEducation,
  saveAddress,
  saveBasics,
  saveEmails,
  savePhone,
  saveProfessional,
  saveResidency,
} from "@/features/perfis/actions";
import { DeleteEducationButton, SectionVisibilityForm } from "@/features/perfis/components/education-forms";
import { ProfileForm } from "@/features/perfis/components/profile-form";
import { getOwnProfile } from "@/features/perfis/queries";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Meu perfil" };

const s = (value: string | number | null | undefined) => (value === null || value === undefined ? "" : String(value));

export default async function ProfilePage() {
  const member = await requireActiveMember();
  const data = await getOwnProfile(member.id);
  const { profile, residency, emails, phone, address, professional, education, privacy } = data;

  return (
    <div className="flex flex-col gap-10">
      <SectionHeading as="h1" kicker="Área de integrantes" title="Meu perfil" />
      <Notice>
        Cada bloco é salvo separadamente. Em &quot;Quem pode ver&quot;, <strong>Público</strong> só chega a
        visitantes se você autorizar aparecer no portal público; sem isso, vale como &quot;Somente
        membros&quot;. O que é <strong>Privado</strong> não é visto nem pelos administradores.
      </Notice>

      <section className="flex flex-col gap-4">
        <SectionHeading number="01" title="Identificação" />
        <Card>
          <ProfileForm
            action={saveBasics}
            initial={{
              fullName: profile.full_name,
              displayName: profile.display_name,
              nickname: s(profile.nickname),
              bio: s(profile.bio),
              originCity: s(profile.origin_city),
              originState: s(profile.origin_state),
              originCountry: s(profile.origin_country),
              currentCity: s(profile.current_city),
              currentCountry: s(profile.current_country),
            }}
            fields={[
              { name: "fullName", label: "Nome completo", autoComplete: "name", required: true },
              { name: "displayName", label: "Nome de exibição", required: true, hint: "Como aparece no portal." },
              { name: "nickname", label: "Apelido" },
              { name: "bio", label: "Biografia", kind: "textarea" },
              { name: "originCity", label: "Cidade de origem" },
              { name: "originState", label: "Estado ou região de origem" },
              { name: "originCountry", label: "País de origem" },
              { name: "currentCity", label: "Cidade atual" },
              { name: "currentCountry", label: "País atual" },
            ]}
            checkbox={{
              name: "showOnPublicPortal",
              label: "Autorizo aparecer na parte pública do portal",
              checked: profile.show_on_public_portal,
              hint: "Visitantes veem nome de exibição, apelido, biografia e as seções que você marcar como públicas.",
            }}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="02" title="Período na república" />
        <Card>
          <ProfileForm
            action={saveResidency}
            initial={{ joinedOn: s(residency.joined_republic_on), leftOn: s(residency.left_republic_on) }}
            fields={[
              { name: "joinedOn", label: "Entrada", kind: "date" },
              { name: "leftOn", label: "Saída", kind: "date", hint: "Deixe em branco se ainda mora na casa." },
            ]}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="03" title="Contato" />
        <Card className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">E-mail oficial</h3>
          <p className="text-sepia-escuro">
            Endereço para comunicados da república. É independente do e-mail de login ({s(member.email)}).
          </p>
          <ProfileForm
            action={saveEmails}
            visibility={privacy.emails}
            initial={{ officialEmail: s(emails?.official_email) }}
            fields={[{ name: "officialEmail", label: "E-mail oficial", kind: "email", autoComplete: "email", wide: true }]}
          />
        </Card>
        <Card className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">Telefone e WhatsApp</h3>
          <ProfileForm
            action={savePhone}
            visibility={privacy.phone}
            initial={{ phone: s(phone?.phone), whatsapp: s(phone?.whatsapp) }}
            fields={[
              { name: "phone", label: "Telefone", kind: "tel", autoComplete: "tel" },
              { name: "whatsapp", label: "WhatsApp", kind: "tel" },
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">Endereço</h3>
          <p className="text-sepia-escuro">Opcional. Preencha só se quiser receber correspondência da república.</p>
          <ProfileForm
            action={saveAddress}
            visibility={privacy.address}
            initial={{
              street: s(address?.street),
              complement: s(address?.complement),
              district: s(address?.district),
              city: s(address?.city),
              state: s(address?.state),
              postalCode: s(address?.postal_code),
              country: s(address?.country),
            }}
            fields={[
              { name: "street", label: "Rua e número", autoComplete: "address-line1", wide: true },
              { name: "complement", label: "Complemento", autoComplete: "address-line2" },
              { name: "district", label: "Bairro" },
              { name: "city", label: "Cidade", autoComplete: "address-level2" },
              { name: "state", label: "Estado", autoComplete: "address-level1" },
              { name: "postalCode", label: "CEP", autoComplete: "postal-code" },
              { name: "country", label: "País", autoComplete: "country-name" },
            ]}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="04" title="Formação" />
        <Card className="flex flex-col gap-5">
          {education.length === 0 ? (
            <p>Nenhuma formação cadastrada.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {education.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-sepia pb-3 last:border-b-0"
                >
                  <span>
                    <span className="block font-semibold">{item.course}</span>
                    <span className="text-sepia-escuro">
                      {item.institution}
                      {item.start_year || item.end_year
                        ? ` · ${s(item.start_year) || "?"} a ${s(item.end_year) || "em curso"}`
                        : ""}
                    </span>
                  </span>
                  <DeleteEducationButton id={item.id} label={item.course} />
                </li>
              ))}
            </ul>
          )}
          <SectionVisibilityForm section="academic" visibility={privacy.academic} />
          <div className="fio-duplo pt-4">
            <h3 className="mb-3 text-xl font-semibold">Adicionar formação</h3>
            <ProfileForm
              action={addEducation}
              submitLabel="Adicionar"
              initial={{ course: "", institution: "", startYear: "", endYear: "" }}
              fields={[
                { name: "course", label: "Curso", required: true },
                { name: "institution", label: "Faculdade ou instituição", required: true },
                { name: "startYear", label: "Ano de ingresso", kind: "number" },
                { name: "endYear", label: "Ano de conclusão", kind: "number" },
              ]}
            />
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="05" title="Profissional" />
        <Card>
          <ProfileForm
            action={saveProfessional}
            visibility={privacy.professional}
            initial={{
              company: s(professional?.company),
              jobTitle: s(professional?.job_title),
              field: s(professional?.field),
              linkedinUrl: s(professional?.linkedin_url),
              websiteUrl: s(professional?.website_url),
              pitch: s(professional?.pitch),
              skills: (professional?.skills ?? []).join(", "),
            }}
            fields={[
              { name: "company", label: "Empresa", autoComplete: "organization" },
              { name: "jobTitle", label: "Cargo", autoComplete: "organization-title" },
              { name: "field", label: "Área de atuação", wide: true },
              { name: "linkedinUrl", label: "LinkedIn", kind: "url", hint: "Endereço completo, com https://" },
              { name: "websiteUrl", label: "Site profissional", kind: "url" },
              { name: "skills", label: "Competências", wide: true, hint: "Separe por vírgulas. Até 30." },
              { name: "pitch", label: "Apresentação profissional", kind: "textarea" },
            ]}
          />
        </Card>
      </section>

      <Notice>A foto de perfil e o pedido de exclusão de conta entram na próxima entrega, junto com o diretório.</Notice>
    </div>
  );
}
