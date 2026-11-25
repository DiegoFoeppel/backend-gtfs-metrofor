// Integração: exporta o banco real e confere o SQLite contra o Postgres.
// Execute com: npm run test:db
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportSqlite } from "./export-sqlite.js";
import { getTravelTime } from "../db/queries.js";
import { db } from "../db/index.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "metrofor-"));
const file = path.join(dir, "metrofor.db");
let sqlite: DatabaseSync;
let counts: Record<string, number>;

beforeAll(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    counts = await exportSqlite(client, file);
  } finally {
    await client.end();
  }
  sqlite = new DatabaseSync(file, { readOnly: true });
});

afterAll(async () => {
  sqlite?.close();
  fs.rmSync(dir, { recursive: true, force: true });
  await db.$client.end();
});

describe("exportSqlite (banco real)", () => {
  it("copia todas as linhas das tabelas principais", () => {
    for (const table of ["routes", "stops", "trips", "stop_times"]) {
      const { n } = sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as {
        n: number;
      };
      expect(n).toBe(counts[table]);
      expect(n).toBeGreaterThan(0);
    }
  });

  it("guarda a versão do schema", () => {
    const { user_version } = sqlite.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(user_version).toBe(1);
  });

  it("o tempo de viagem em SQL puro bate com o do Postgres", async () => {
    const expected = await getTravelTime("1", "1", "11", 0);
    const row = sqlite
      .prepare(
        `SELECT COUNT(*) AS trips, ROUND(AVG(d) / 60.0) AS avg_min FROM (
           SELECT b.arrival_sec - a.departure_sec AS d
           FROM trips t
           JOIN stop_times a ON a.trip_id = t.trip_id AND a.stop_id = ?
           JOIN stop_times b ON b.trip_id = t.trip_id AND b.stop_id = ?
            AND b.stop_sequence > a.stop_sequence
           WHERE t.route_id = ? AND t.direction_id = ?
         )`,
      )
      .get("1", "11", "1", 0) as { trips: number; avg_min: number };

    expect(row.trips).toBe(expected.trips);
    expect(Math.abs(row.avg_min - expected.minutes!)).toBeLessThanOrEqual(1);
  });
});
