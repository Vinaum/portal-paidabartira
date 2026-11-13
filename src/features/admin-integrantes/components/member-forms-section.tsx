import { Card } from "@/components/ui/card";
import type { MemberCategory, MemberRole, MemberStatus } from "@/lib/permissions";

import { RoleForm, UpdateMemberForm } from "./member-forms";

/** Blocos de edição do vínculo e do papel. */
export function MemberForms({
  member,
  canEditRole,
  assignableRoles,
}: {
  member: { id: string; category: MemberCategory; isFounder: boolean; status: MemberStatus; role: MemberRole };
  canEditRole: boolean;
  assignableRoles: MemberRole[];
}) {
  return (
    <>
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Vínculo</h2>
        <UpdateMemberForm
          memberId={member.id}
          category={member.category}
          isFounder={member.isFounder}
          status={member.status}
        />
      </Card>
      {canEditRole ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Papel</h2>
          <RoleForm memberId={member.id} role={member.role} assignableRoles={assignableRoles} />
        </Card>
      ) : null}
    </>
  );
}
