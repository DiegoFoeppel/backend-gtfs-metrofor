import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../server.js";
import { db } from "../db/index.js";
import { selectChain } from "../test/helpers.js";

const route = { routeId: "1", routeLongName: "Linha Sul", routeColor: "0000ff" };

const mockSelect = (rows: unknown[]) =>
  vi.spyOn(db, "select").mockReturnValue(selectChain(rows) as never);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/routes/health", () => {
  it("responde working", async () => {
    const res = await request(app).get("/api/routes/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ msg: "working" });
  });
});

describe("GET /api/routes", () => {
  it("lista as linhas", async () => {
    mockSelect([route]);
    const res = await request(app).get("/api/routes");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ routes: [route] });
  });
});

describe("GET /api/routes/:routeId/stops", () => {
  it("devolve linha, sentidos e estações (200)", async () => {
    mockSelect([route]);
    const directions = [
      { id: 0, label: " Carlito" },
      { id: 1, label: " Chico" },
    ];
    const stops = [{ stopId: "1", stopName: "Chico da Silva" }];
    vi.spyOn(db, "execute")
      .mockResolvedValueOnce({ rows: directions } as never) // getDirections
      .mockResolvedValueOnce({ rows: stops } as never); // getStops

    const res = await request(app).get("/api/routes/1/stops?directionId=1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ route, directions, stops });
  });

  it("responde 404 uma única vez quando a linha não existe", async () => {
    mockSelect([]);
    const execute = vi.spyOn(db, "execute");

    const res = await request(app).get("/api/routes/zzz/stops");

    expect(res.status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("GET /api/routes/:routeId/travel-time", () => {
  const travel = (query: string) =>
    request(app).get(`/api/routes/1/travel-time${query}`);

  it("exige from e to", async () => {
    expect((await travel("")).status).toBe(400);
    expect((await travel("?from=1")).status).toBe(400);
    expect((await travel("?to=11")).status).toBe(400);
  });

  it("rejeita from igual a to", async () => {
    const res = await travel("?from=1&to=1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/);
  });

  it("rejeita directionId inválido", async () => {
    expect((await travel("?from=1&to=11&directionId=x")).status).toBe(400);
  });

  it("responde 404 quando não há viagem direta", async () => {
    vi.spyOn(db, "execute").mockResolvedValue({
      rows: [{ trips: 0, minMinutes: null, minutes: null, maxMinutes: null }],
    } as never);

    const res = await travel("?from=18&to=1&directionId=0");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no direct trip/);
  });

  it("devolve o tempo estimado", async () => {
    vi.spyOn(db, "execute").mockResolvedValue({
      rows: [{ trips: 53, minMinutes: 38, minutes: 40, maxMinutes: 42 }],
    } as never);

    const res = await travel("?from=1&to=11&directionId=0");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      routeId: "1",
      from: "1",
      to: "11",
      trips: 53,
      minMinutes: 38,
      minutes: 40,
      maxMinutes: 42,
    });
  });

  it("funciona sem directionId", async () => {
    vi.spyOn(db, "execute").mockResolvedValue({
      rows: [{ trips: 10, minMinutes: 5, minutes: 5, maxMinutes: 5 }],
    } as never);

    expect((await travel("?from=1&to=2")).status).toBe(200);
  });

  it("responde 500 quando o banco falha", async () => {
    vi.spyOn(db, "execute").mockRejectedValue(new Error("boom"));
    const res = await travel("?from=1&to=11");
    expect(res.status).toBe(500);
  });
});
