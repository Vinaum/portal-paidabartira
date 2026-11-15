import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_PERMISSIONS, canAccessAdmin, isPermission } from "@/lib/permissions";

describe("permissões", () => {
  it("a lista da aplicação é idêntica à da migration", () => {
    // As permissões nascem na base e podem ser acrescentadas por migrations posteriores.
    const inDatabase = readdirSync("supabase/migrations")
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
        const start = sql.indexOf("insert into public.permissions");
        if (start < 0) return [];
        const end = sql.indexOf(";", start);
        return [...sql.slice(start, end).matchAll(/\('([a-z_]+\.[a-z_]+)',/g)].map((m) => m[1]);
      })
      .sort();
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
