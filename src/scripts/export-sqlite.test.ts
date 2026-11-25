import { describe, expect, it } from "vitest";
import { toSeconds } from "./export-sqlite.js";

describe("toSeconds", () => {
  it("converte HH:MM:SS", () => {
    expect(toSeconds("05:40:00")).toBe(20400);
    expect(toSeconds("00:00:30")).toBe(30);
  });
  it("aceita horários acima de 24h (GTFS)", () => {
    expect(toSeconds("24:10:00")).toBe(87000);
  });
  it("devolve null para vazio ou inválido", () => {
    expect(toSeconds(null)).toBeNull();
    expect(toSeconds("")).toBeNull();
    expect(toSeconds("abc")).toBeNull();
  });
});
