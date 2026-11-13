import { describe, expect, it } from "vitest";

import {
  basicsSchema,
  educationSchema,
  emailsSchema,
  professionalSchema,
  residencySchema,
  sectionVisibilitySchema,
} from "@/features/perfis/schemas";

describe("perfil: identificação", () => {
  const base = {
    fullName: "Fulano de Tal", displayName: "Fulano", nickname: "", bio: "", originCity: "", originState: "",
    originCountry: "", currentCity: " Campinas ", currentCountry: "", showOnPublicPortal: false,
  };
  it("vazio vira null e texto é aparado", () => {
    const parsed = basicsSchema.parse(base);
    expect(parsed.nickname).toBeNull();
    expect(parsed.currentCity).toBe("Campinas");
  });
  it("exige nome de exibição", () => {
    expect(basicsSchema.safeParse({ ...base, displayName: " " }).success).toBe(false);
  });
  it("não aceita campos de privilégio", () => {
    const parsed = basicsSchema.parse({ ...base, role: "superadmin", category: "ex_morador", status: "active" });
    expect(Object.keys(parsed)).not.toContain("role");
    expect(Object.keys(parsed)).not.toContain("category");
  });
});

describe("perfil: período e formação", () => {
  it("recusa saída anterior à entrada", () => {
    expect(residencySchema.safeParse({ joinedOn: "2011-01-01", leftOn: "2006-01-01" }).success).toBe(false);
    expect(residencySchema.parse({ joinedOn: "2006-03-01", leftOn: "" })).toEqual({ joinedOn: "2006-03-01", leftOn: null });
  });
  it("recusa data malformada", () => {
    expect(residencySchema.safeParse({ joinedOn: "01/03/2006", leftOn: "" }).success).toBe(false);
  });
  it("valida anos da formação", () => {
    const base = { course: "Engenharia de Computação", institution: "UNICAMP" };
    expect(educationSchema.parse({ ...base, startYear: "2006", endYear: "" })).toMatchObject({ startYear: 2006, endYear: null });
    expect(educationSchema.safeParse({ ...base, startYear: "2011", endYear: "2006" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, startYear: "abc", endYear: "" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, startYear: "1800", endYear: "" }).success).toBe(false);
  });
});

describe("perfil: contato e profissional", () => {
  it("e-mail oficial é opcional, mas precisa ser válido", () => {
    expect(emailsSchema.parse({ officialEmail: "", visibility: "members" }).officialEmail).toBeNull();
    expect(emailsSchema.safeParse({ officialEmail: "x@", visibility: "members" }).success).toBe(false);
  });
  it("só aceita visibilidades conhecidas", () => {
    expect(emailsSchema.safeParse({ officialEmail: "", visibility: "todos" }).success).toBe(false);
    expect(sectionVisibilitySchema.safeParse({ section: "role", visibility: "public" }).success).toBe(false);
  });
  const prof = { company: "", jobTitle: "", field: "", linkedinUrl: "", websiteUrl: "", pitch: "", skills: "", visibility: "members" };
  it("links precisam ser endereços completos e seguros", () => {
    expect(professionalSchema.safeParse({ ...prof, linkedinUrl: "linkedin.com/in/x" }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...prof, linkedinUrl: "http://linkedin.com/in/x" }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...prof, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...prof, linkedinUrl: "https://www.linkedin.com/in/x" }).success).toBe(true);
  });
  it("competências: separa, apara, remove repetidas e limita", () => {
    expect(professionalSchema.parse({ ...prof, skills: " Python, SQL ,, Python " }).skills).toEqual(["Python", "SQL"]);
    const many = Array.from({ length: 31 }, (_, i) => `c${i}`).join(",");
    expect(professionalSchema.safeParse({ ...prof, skills: many }).success).toBe(false);
  });
});
