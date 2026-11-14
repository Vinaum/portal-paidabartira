import { describe, expect, it } from "vitest";

import { nextOccurrence, upcomingBirthdays } from "@/features/aniversarios/dates";

describe("nextOccurrence", () => {
  it("hoje conta", () => expect(nextOccurrence(13, 11, "2026-11-13")).toBe("2026-11-13"));
  it("já passou neste ano: vira o ano seguinte", () => expect(nextOccurrence(1, 3, "2026-11-13")).toBe("2027-03-01"));
  it("29/02 em ano comum cai em 28/02", () => expect(nextOccurrence(29, 2, "2026-11-13")).toBe("2027-02-28"));
  it("29/02 em ano bissexto fica em 29/02", () => expect(nextOccurrence(29, 2, "2027-11-13")).toBe("2028-02-29"));
});

describe("upcomingBirthdays", () => {
  const list = [
    { memberId: "a", name: "Ana", day: 20, month: 11 },
    { memberId: "b", name: "Bia", day: 14, month: 11 },
    { memberId: "c", name: "Caio", day: 1, month: 6 },
  ];
  it("filtra pela janela e ordena por data", () => {
    expect(upcomingBirthdays(list, "2026-11-13", 30).map((b) => b.name)).toEqual(["Bia", "Ana"]);
  });
  it("atravessa a virada de ano", () => {
    expect(upcomingBirthdays([{ memberId: "d", name: "Duda", day: 2, month: 1 }], "2026-12-20", 30).map((b) => b.date)).toEqual(["2027-01-02"]);
  });
});
