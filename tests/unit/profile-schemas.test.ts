import { describe, expect, it } from "vitest";

import {
  basicsSchema,
  educationSchema,
  emailsSchema,
  professionalSchema,
  normalizeSocialUrl,
  periodSchema,
  periodsOverlap,
  socialSchema,
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
  it("período: mês e ano, saída opcional", () => {
    expect(periodSchema.parse({ startedOn: "2007-03", endedOn: "" })).toEqual({ startedOn: "2007-03", endedOn: null });
    expect(periodSchema.safeParse({ startedOn: "2011-01", endedOn: "2006-01" }).success).toBe(false);
    expect(periodSchema.safeParse({ startedOn: "2007-13", endedOn: "" }).success).toBe(false);
    expect(periodSchema.safeParse({ startedOn: "03/2007", endedOn: "" }).success).toBe(false);
    expect(periodSchema.safeParse({ startedOn: "2099-01", endedOn: "" }).success).toBe(false);
  });
  it("detecta períodos sobrepostos, inclusive o que vai até hoje", () => {
    const first = { startedOn: "2007-03", endedOn: "2010-07" };
    expect(periodsOverlap(first, { startedOn: "2011-05", endedOn: "2011-12" })).toBe(false);
    expect(periodsOverlap(first, { startedOn: "2010-07", endedOn: "2011-01" })).toBe(true);
    expect(periodsOverlap(first, { startedOn: "2009-01", endedOn: null })).toBe(true);
    expect(periodsOverlap({ startedOn: "2012-01", endedOn: null }, { startedOn: "2015-01", endedOn: "2016-01" })).toBe(true);
  });
  it("valida anos da formação", () => {
    const base = { course: "Engenharia de Computação", institution: "UNICAMP", completion: "completed" };
    expect(educationSchema.parse({ ...base, startYear: "2006", endYear: "" })).toMatchObject({ startYear: 2006, endYear: null });
    expect(educationSchema.safeParse({ ...base, startYear: "2011", endYear: "2006" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, startYear: "abc", endYear: "" }).success).toBe(false);
    expect(educationSchema.safeParse({ ...base, startYear: "1800", endYear: "" }).success).toBe(false);
  });
  it("formação pode não ter sido concluída", () => {
    const base = { course: "Física", institution: "UNICAMP", startYear: "2004", endYear: "2005" };
    expect(educationSchema.parse({ ...base, completion: "not_completed" }).completion).toBe("not_completed");
    expect(educationSchema.safeParse({ ...base, completion: "comprado" }).success).toBe(false);
    expect(educationSchema.safeParse(base).success).toBe(false);
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
  const prof = { company: "", jobTitle: "", field: "", websiteUrl: "", pitch: "", skills: "", visibility: "members" };
  it("site profissional precisa ser um endereço completo e seguro", () => {
    expect(professionalSchema.safeParse({ ...prof, websiteUrl: "meusite.com" }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...prof, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(professionalSchema.safeParse({ ...prof, websiteUrl: "https://meusite.com" }).success).toBe(true);
  });
  it("competências: separa, apara, remove repetidas e limita", () => {
    expect(professionalSchema.parse({ ...prof, skills: " Python, SQL ,, Python " }).skills).toEqual(["Python", "SQL"]);
    const many = Array.from({ length: 31 }, (_, i) => `c${i}`).join(",");
    expect(professionalSchema.safeParse({ ...prof, skills: many }).success).toBe(false);
  });
});

describe("perfil: redes sociais", () => {
  it("aceita @usuário e monta o endereço da rede", () => {
    expect(normalizeSocialUrl("instagram", "@fulano.tal")).toBe("https://www.instagram.com/fulano.tal");
    expect(normalizeSocialUrl("github", "fulano")).toBe("https://github.com/fulano");
    expect(normalizeSocialUrl("linkedin", "fulano-de-tal")).toBe("https://www.linkedin.com/in/fulano-de-tal");
  });
  it("aceita endereço com ou sem https e vazio vira null", () => {
    expect(normalizeSocialUrl("linkedin", "linkedin.com/in/fulano")).toBe("https://linkedin.com/in/fulano");
    expect(normalizeSocialUrl("x", "https://twitter.com/fulano")).toBe("https://twitter.com/fulano");
    expect(normalizeSocialUrl("facebook", "  ")).toBeNull();
  });
  it("recusa endereço de outro site, http e esquemas perigosos", () => {
    expect(normalizeSocialUrl("instagram", "https://malicioso.example/instagram.com")).toBeUndefined();
    expect(normalizeSocialUrl("instagram", "https://instagram.com.malicioso.example/x")).toBeUndefined();
    expect(normalizeSocialUrl("instagram", "http://instagram.com/fulano")).toBeUndefined();
    expect(normalizeSocialUrl("github", "javascript:alert(1)//github.com")).toBeUndefined();
    expect(normalizeSocialUrl("github", "https://user:pass@github.com/x")).toBeUndefined();
  });
  it("o formulário devolve erro por campo", () => {
    const empty = { linkedin: "", instagram: "", facebook: "", x: "", github: "", other: "", visibility: "members" };
    expect(socialSchema.parse({ ...empty, instagram: "@fulano" }).instagram).toBe("https://www.instagram.com/fulano");
    const bad = socialSchema.safeParse({ ...empty, instagram: "https://outro.example/fulano" });
    expect(bad.success).toBe(false);
    expect(socialSchema.safeParse({ ...empty, other: "http://inseguro.example" }).success).toBe(false);
  });
});
