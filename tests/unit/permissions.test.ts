import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_PERMISSIONS, canAccessAdmin, isPermission } from "@/lib/permissions";

describe("permissões", () => {
  it("a lista da aplicação é idêntica à da migration", () => {
    const sql = readFileSync("supabase/migrations/20261112000100_base.sql", "utf8");
    const block = sql.slice(
      sql.indexOf("insert into public.permissions"),
      sql.indexOf("insert into public.role_permissions"),
    );
    const inDatabase = [...block.matchAll(/\('([a-z_]+\.[a-z_]+)',/g)].map((m) => m[1]).sort();
    expect(inDatabase.length).toBeGreaterThan(0);
    expect([...ALL_PERMISSIONS].sort()).toEqual(inDatabase);
  });

  it("reconhece só nomes válidos", () => {
    expect(isPermission("finance.write")).toBe(true);
    expect(isPermission("finance.delete")).toBe(false);
  });

  it("membro sem permissões não entra no painel admin", () => {
    expect(canAccessAdmin([])).toBe(false);
    expect(canAccessAdmin(["events.manage"])).toBe(true);
  });
});
