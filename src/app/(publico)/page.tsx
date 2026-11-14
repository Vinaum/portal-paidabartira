import { Suspense } from "react";

import { LogoSeal } from "@/components/layout/logo-seal";
import { ButtonLink } from "@/components/ui/button";
import { PhotoFrame, PhotoPlaceholder } from "@/components/ui/photo-frame";
import { SectionHeading } from "@/components/ui/section-heading";
import { foundedOnLong, site } from "@/config/site";
import { HistoryText, HouseImage, HousePeople } from "@/features/portal/components/home-sections";
import { HomeUpcomingEvents } from "@/features/eventos/components/public-events";

/**
 * Página inicial: identidade da república e entrada para a área restrita.
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
            <ButtonLink href="/solicitar-acesso">Solicitar acesso</ButtonLink>
            <ButtonLink href="/login" variant="outline">
              Já tenho conta
            </ButtonLink>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <PhotoFrame caption="Foto da república" tilt="right">
            <Suspense fallback={<PhotoPlaceholder label="Carregando foto" />}>
              <HouseImage />
            </Suspense>
          </PhotoFrame>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="01" kicker="Memória" title="Nossa história" />
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
          <LogoSeal size={132} />
          <Suspense fallback={<p>Carregando…</p>}>
            <HistoryText />
          </Suspense>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="02" kicker="Agenda" title="Próximos eventos" />
        <Suspense fallback={<p>Carregando eventos…</p>}>
          <HomeUpcomingEvents />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading number="03" kicker="Pessoas" title="Quem faz a casa" />
        <Suspense fallback={<p>Carregando…</p>}>
          <HousePeople />
        </Suspense>
      </section>
    </div>
  );
}
