/* eslint-disable @next/next/no-img-element -- imagem institucional do bucket público. */
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { PhotoPlaceholder } from "@/components/ui/photo-frame";
import { foundedOnLong, placeholder, site } from "@/config/site";

import { getHouseStats, getSiteContent, listPublicPeople } from "../queries";
import { PeopleGrid } from "./people";

export async function HouseImage() {
  const { housePhotoUrl } = await getSiteContent();
  return housePhotoUrl ? (
    <img src={housePhotoUrl} alt="A casa da república" className="h-full w-full object-cover" />
  ) : (
    <PhotoPlaceholder label="Foto da casa — a enviar" />
  );
}

export async function HistoryText() {
  const { history } = await getSiteContent();
  const paragraphs = (history ?? "").split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="flex max-w-prose flex-col gap-3">
      <p>
        A {site.name} foi fundada em {foundedOnLong()}.{paragraphs.length === 0 ? ` ${placeholder("Texto da história da república")}` : ""}
      </p>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export async function HousePeople() {
  const [stats, people] = await Promise.all([getHouseStats(), listPublicPeople()]);
  const residents = people.filter((person) => person.category === "atual_morador").slice(0, 4);
  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-3">
        {[
          [stats.currentResidents, "moram aqui hoje"],
          [stats.formerResidents, "já moraram"],
          [stats.founders, "fundadores"],
        ].map(([value, label]) => (
          <li key={label} className="rounded-sm border-2 border-sepia bg-papel p-4 text-center">
            <p className="font-display text-4xl font-bold">{value}</p>
            <p className="rotulo text-sepia-escuro">{label}</p>
          </li>
        ))}
      </ul>
      {residents.length > 0 ? <PeopleGrid people={residents} /> : null}
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/moradores" variant="outline">
          Ver moradores
        </ButtonLink>
        <ButtonLink href="/ex-moradores" variant="outline">
          Quem já passou por aqui
        </ButtonLink>
      </div>
    </div>
  );
}

export async function ContactEmail() {
  const { contactEmail } = await getSiteContent();
  return contactEmail ? (
    <Link href={`mailto:${contactEmail}`} className="underline underline-offset-4">
      {contactEmail}
    </Link>
  ) : (
    <>{placeholder("E-mail de contato")}</>
  );
}
