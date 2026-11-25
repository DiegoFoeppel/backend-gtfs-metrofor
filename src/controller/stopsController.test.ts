import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../server.js";
import { db } from "../db/index.js";
import { selectChain } from "../test/helpers.js";

const stop = { stopId: "14", stopName: "Padre Cícero", stopCode: "PCI" };

const mockSelect = (rows: unknown[]) =>
  vi.spyOn(db, "select").mockReturnValue(selectChain(rows) as never);
const mockExecute = (rows: unknown[]) =>
  vi.spyOn(db, "execute").mockResolvedValue({ rows } as never);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/stops", () => {
  it("lista as estações", async () => {
    mockSelect([stop]);
    const res = await request(app).get("/api/stops");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stops: [stop] });
  });

  it("responde 500 sem vazar o erro interno", async () => {
    vi.spyOn(db, "select").mockImplementation(() => {
      throw new Error("connection refused at 10.0.0.5");
    });
    const res = await request(app).get("/api/stops");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("10.0.0.5");
  });
});

describe("GET /api/stops/:stopId", () => {
  it("retorna a estação", async () => {
    mockSelect([stop]);
    const res = await request(app).get("/api/stops/14");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stop });
  });

  it("responde 404 uma única vez quando não existe", async () => {
    mockSelect([]);
    const res = await request(app).get("/api/stops/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/stopId/);
    expect(console.error).not.toHaveBeenCalled(); // sem "headers already sent"
  });
});

describe("GET /api/stops/:stopId/timetables", () => {
  it("sem sentido, devolve a grade completa por sentido", async () => {
    mockSelect([stop]);
    const timetables = [
      { directionId: 0, sentido: "Carlito Benevides", horarios: ["05:00", "05:20"] },
      { directionId: 1, sentido: "Chico da Silva", horarios: ["05:10"] },
    ];
    mockExecute(timetables);

    const res = await request(app).get("/api/stops/14/timetables");

    expect(res.status).toBe(200);
    expect(res.body.stop).toEqual(stop);
    expect(res.body.timetables).toEqual(timetables);
    expect(res.body.nextDepartures).toBeUndefined();
  });

  it("com sentido, devolve só as próximas partidas", async () => {
    mockSelect([stop]);
    mockExecute([{ horario: "13:32" }, { horario: "13:54" }]);

    const res = await request(app).get("/api/stops/14/timetables?directionId=0");

    expect(res.status).toBe(200);
    expect(res.body.nextDepartures).toEqual(["13:32", "13:54"]);
    expect(res.body.timetables).toBeUndefined();
  });

  it("responde 400 para directionId inválido", async () => {
    const select = mockSelect([stop]);
    const res = await request(app).get("/api/stops/14/timetables?directionId=abc");

    expect(res.status).toBe(400);
    expect(select).not.toHaveBeenCalled();
  });

  it("responde 404 quando a estação não existe e não consulta horários", async () => {
    mockSelect([]);
    const execute = mockExecute([]);

    const res = await request(app).get("/api/stops/999/timetables?directionId=0");

    expect(res.status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("responde 500 quando o banco falha", async () => {
    mockSelect([stop]);
    vi.spyOn(db, "execute").mockRejectedValue(new Error("boom"));

    const res = await request(app).get("/api/stops/14/timetables");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to fetch timetables" });
  });
});
