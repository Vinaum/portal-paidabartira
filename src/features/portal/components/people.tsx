import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { MemberPhoto } from "@/features/diretorio/components/member-photo";

import type { PublicPerson } from "../queries";

export function PersonCard({ person }: { person: PublicPerson }) {
  return (
    <Card className="flex gap-4">
      <MemberPhoto url={person.photoUrl} name={person.name} size={88} />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-xl font-semibold">
          {person.name}
          {person.nickname && person.nickname.toLowerCase() !== person.name.toLowerCase() ? <span className="font-normal text-sepia-escuro"> “{person.nickname}”</span> : null}
        </h3>
        <p className="flex flex-wrap gap-2">
          {person.isFounder ? <Stamp tone="verde">Fundador</Stamp> : null}
          <Stamp tone="preto">{person.category === "atual_morador" ? "Mora aqui" : "Ex-morador"}</Stamp>
        </p>
        {person.bio ? <p className="line-clamp-3 whitespace-pre-line">{person.bio}</p> : null}
      </div>
    </Card>
  );
}

export function PeopleGrid({ people }: { people: PublicPerson[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {people.map((person) => (
        <li key={person.id}>
          <PersonCard person={person} />
        </li>
      ))}
    </ul>
  );
}
