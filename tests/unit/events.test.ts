import { describe, expect, it } from "vitest";

import { eventSchema, rsvpSchema } from "@/features/eventos/schemas";
import { eventDayParts, formatEventWhen, fromLocalInput, isPast, toLocalInput } from "@/features/eventos/time";

describe("eventos: horário de Brasília", () => {
  it("converte o campo do formulário em instante (UTC-3) e volta igual", () => {
    expect(fromLocalInput("2026-11-14T19:00")).toBe("2026-11-14T22:00:00.000Z");
    expect(toLocalInput("2026-11-14T22:00:00.000Z")).toBe("2026-11-14T19:00");
  });
  it("vira o dia corretamente", () => {
    expect(fromLocalInput("2026-11-14T23:30")).toBe("2026-11-15T02:30:00.000Z");
    expect(toLocalInput("2026-11-15T02:30:00.000Z")).toBe("2026-11-14T23:30");
  });
  it("recusa texto inválido", () => {
    expect(fromLocalInput("14/11/2026 19:00")).toBeNull();
    expect(fromLocalInput("2026-13-40T25:61")).toBeNull();
    expect(fromLocalInput("")).toBeNull();
  });
  it("formata para a tela", () => {
    expect(formatEventWhen("2026-11-14T22:00:00.000Z", "2026-11-15T01:00:00.000Z")).toMatch(/sábado, 14 de novembro · 19:00 às 22:00/);
    expect(formatEventWhen("2026-11-14T22:00:00.000Z", null)).toMatch(/19:00$/);
    expect(eventDayParts("2026-11-14T22:00:00.000Z")).toEqual({ day: "14", month: "nov" });
  });
  it("sem hora de fim, vale o início", () => {
    const now = new Date("2026-11-14T12:00:00.000Z");
    expect(isPast("2026-11-14T11:00:00.000Z", null, now)).toBe(true);
    expect(isPast("2026-11-14T11:00:00.000Z", "2026-11-14T13:00:00.000Z", now)).toBe(false);
  });
});

describe("eventos: formulário", () => {
  const base = {
    eventId: "",
    title: "Churrasco de aniversário",
    description: "",
    location: " Rua das Flores, 100 ",
    startsAt: "2026-11-14T19:00",
    endsAt: "",
    visibility: "public",
    status: "draft",
  };
  it("aceita e normaliza", () => {
    const parsed = eventSchema.parse(base);
    expect(parsed).toMatchObject({
      eventId: null,
      description: null,
      location: "Rua das Flores, 100",
      startsAt: "2026-11-14T22:00:00.000Z",
      endsAt: null,
    });
  });
  it("recusa fim antes do início e título curto", () => {
    const result = eventSchema.safeParse({ ...base, endsAt: "2026-11-14T18:00" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endsAt"]);
    expect(eventSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
  });
  it("recusa situação e visibilidade desconhecidas", () => {
    expect(eventSchema.safeParse({ ...base, status: "arquivado" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, visibility: "amigos" }).success).toBe(false);
  });
});

describe("eventos: presença", () => {
  const id = "aaaaaaaa-0000-4000-8000-000000000001";
  it("acompanhantes de 0 a 10; vazio vale 0", () => {
    expect(rsvpSchema.parse({ eventId: id, answer: "going", guests: "" }).guests).toBe(0);
    expect(rsvpSchema.parse({ eventId: id, answer: "going", guests: "3" }).guests).toBe(3);
    expect(rsvpSchema.safeParse({ eventId: id, answer: "going", guests: "11" }).success).toBe(false);
    expect(rsvpSchema.safeParse({ eventId: id, answer: "going", guests: "-1" }).success).toBe(false);
    expect(rsvpSchema.safeParse({ eventId: id, answer: "going", guests: "1.5" }).success).toBe(false);
  });
  it("recusa resposta desconhecida", () => {
    expect(rsvpSchema.safeParse({ eventId: id, answer: "sim", guests: "0" }).success).toBe(false);
  });
});
