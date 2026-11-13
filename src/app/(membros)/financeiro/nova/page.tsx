import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { FundForm } from "@/features/caixinha/components/fund-form";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nova caixinha" };

export default async function NewFundPage() {
  await requirePermission(PERMISSIONS.financeWrite);
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Caixinhas" title="Nova caixinha" />
      <Card>
        <FundForm />
      </Card>
    </div>
  );
}
