// Testes de integração: rodam contra o banco real (DATABASE_URL do .env).
// Execute com: npm run test:db
import { afterAll, describe, expect, it } from "vitest";
import { db } from "./index.js";
import { getDirections, getStops, getTravelTime } from "./queries.js";

afterAll(async () => {
  await db.$client.end();
});

describe("queries (banco real)", () => {
  it("getStops devolve as estações da Linha Sul em ordem de viagem", async () => {
    const dir0 = await getStops("1", 0);
    const dir1 = await getStops("1", 1);

    expect(dir0.length).toBeGreaterThan(5);
    expect(dir0.length).toBe(dir1.length);
    // sentidos opostos percorrem as mesmas paradas ao contrário
    expect(dir0.map((s) => s.stopId)).toEqual(
      dir1.map((s) => s.stopId).reverse(),
    );
  });

  it("getDirections devolve os dois sentidos", async () => {
    const dirs = await getDirections("1");
    expect(dirs.map((d) => d.id)).toEqual([0, 1]);
  });

  it("getTravelTime calcula a duração entre duas paradas", async () => {
    const stops = await getStops("1", 0);
    const first = String(stops[0].stopId);
    const last = String(stops[stops.length - 1].stopId);

    const result = await getTravelTime("1", first, last, 0);

    expect(result.trips).toBeGreaterThan(0);
    expect(result.minutes).toBeGreaterThan(5);
    expect(result.minutes).toBeLessThan(120);
    expect(result.minMinutes!).toBeLessThanOrEqual(result.minutes!);
    expect(result.maxMinutes!).toBeGreaterThanOrEqual(result.minutes!);
  });

  it("getTravelTime não encontra viagem no sentido contrário ao percurso", async () => {
    const stops = await getStops("1", 0);
    const first = String(stops[0].stopId);
    const last = String(stops[stops.length - 1].stopId);

    // da última para a primeira parada no sentido 0: não existe
    const result = await getTravelTime("1", last, first, 0);

    expect(result.trips).toBe(0);
  });

  it("getTravelTime sem sentido encontra a viagem nos dois sentidos", async () => {
    const stops = await getStops("1", 0);
    const first = String(stops[0].stopId);
    const last = String(stops[stops.length - 1].stopId);

    const forward = await getTravelTime("1", first, last, null);
    const backward = await getTravelTime("1", last, first, null);

    expect(forward.trips).toBeGreaterThan(0);
    expect(backward.trips).toBeGreaterThan(0);
  });
});
