import { LogoSeal } from "@/components/layout/logo-seal";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PhotoFrame, PhotoPlaceholder } from "@/components/ui/photo-frame";
import { SectionHeading } from "@/components/ui/section-heading";
import { foundedOnLong, placeholder, site } from "@/config/site";

/**
 * Página inicial da Etapa 2 (Fundação): apresenta a identidade e o acesso.
 * Eventos, moradores, caixinha e solicitação de acesso entram na Etapa 3.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="rotulo text-sepia-escuro">República estudantil · {foundedOnLong()}</p>
          <h1 className="mt-2 text-5xl font-bold text-preto sm:text-6xl">{site.name}</h1>
          <p className="mt-4 max-w-prose text-xl">{site.foundersNote}</p>
          <p className="mt-2 max-w-prose">
            Este é o portal da república: um lugar para guardar a memória da casa e manter
            por perto quem passou por ela.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/login">Entrar no portal</ButtonLink>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <PhotoFrame caption="Foto da república" tilt="right">
            <PhotoPlaceholder label="Foto da casa — a enviar" />
          </PhotoFrame>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="01" kicker="Memória" title="Nossa história" />
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
          <LogoSeal size={132} />
          <div className="max-w-prose">
            <p>
              A {site.name} foi fundada em {foundedOnLong()}.{" "}
              {site.history ?? placeholder("Texto da história da república")}
            </p>
          </div>
        </div>
      </section>

      <Notice>
        O portal está em construção. Eventos, moradores, caixinha e o pedido de acesso para
        novos integrantes chegam nas próximas etapas.
      </Notice>
    </div>
  );
}
