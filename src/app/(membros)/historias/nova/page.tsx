import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StoryForm } from "@/features/historias/components/story-forms";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Contar uma história" };

export default async function NewStoryPage() {
  await requireActiveMember();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Histórias" title="Contar uma história" />
      <Card>
        <StoryForm />
      </Card>
    </div>
  );
}
