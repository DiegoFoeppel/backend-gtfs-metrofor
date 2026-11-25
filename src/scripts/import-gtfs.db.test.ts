// Integração: importa CSVs para um schema temporário (não toca no schema real).
// Execute com: npm run test:db
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importGtfs } from "./import-gtfs.js";

const SCHEMA = "gtfs_import_test";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gtfs-"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const write = (file: string, lines: string[]) =>
  fs.writeFileSync(path.join(dir, file), lines.join("\n"));

const count = async (table: string) =>
  Number(
    (await client.query(`SELECT COUNT(*) n FROM ${SCHEMA}.${table}`)).rows[0].n,
  );

beforeAll(async () => {
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.query(`CREATE SCHEMA ${SCHEMA}`);
  for (const t of ["routes", "stops", "trips", "stop_times", "calendar"]) {
    await client.query(
      `CREATE TABLE ${SCHEMA}.${t} (LIKE gtfs_metrofor.${t} INCLUDING ALL)`,
    );
  }
  write("calendar.txt", [
    "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
    "1,1,1,1,1,1,1,0,20260101,20271231",
  ]);
  write("routes.txt", [
    "route_id,route_short_name,route_long_name,route_type,route_color,feed_id",
    "9,L9,Linha Nove,1,ff0000,metrofor",
  ]);
  write("stops.txt", [
    "stop_id,stop_name,stop_lat,stop_lon,extra_col",
    "a,Alfa,-3.7,-38.5,x",
    "b,Beta,-3.8,-38.6,y",
  ]);
  write("trips.txt", [
    "route_id,service_id,trip_id,trip_headsign,direction_id",
    "9,1,t1,Beta,0",
  ]);
  write("stop_times.txt", [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "t1,05:00:00,05:00:00,a,1",
    "t1,05:10:00,,b,2",
  ]);
});

afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.end();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("importGtfs (schema temporário)", () => {
  it("importa as tabelas, ignora colunas extras e vazio vira NULL", async () => {
    const result = await importGtfs(client, dir, SCHEMA);

    expect(result).toMatchObject({ routes: 1, stops: 2, trips: 1, stop_times: 2, calendar: 1 });
    expect(await count("stops")).toBe(2);
    const { rows } = await client.query(
      `SELECT departure_time FROM ${SCHEMA}.stop_times WHERE stop_sequence = 2`,
    );
    expect(rows[0].departure_time).toBeNull();
  });

  it("reimportar substitui os dados e preserva o city_id da linha", async () => {
    await client.query(`UPDATE ${SCHEMA}.routes SET city_id = '1' WHERE route_id = '9'`);
    write("routes.txt", [
      "route_id,route_short_name,route_long_name,route_type,route_color",
      "9,L9,Linha Nove (nova),1,00ff00",
    ]);

    await importGtfs(client, dir, SCHEMA);

    expect(await count("stops")).toBe(2); // não duplicou
    const { rows } = await client.query(
      `SELECT city_id, route_long_name FROM ${SCHEMA}.routes WHERE route_id = '9'`,
    );
    expect(rows[0]).toEqual({ city_id: "1", route_long_name: "Linha Nove (nova)" });
  });

  it("dry-run não grava nada", async () => {
    write("stops.txt", ["stop_id,stop_name,stop_lat,stop_lon", "z,Zeta,0,0"]);
    await importGtfs(client, dir, SCHEMA, { dryRun: true });
    expect(await count("stops")).toBe(2);
  });

  it("falha sem arquivo obrigatório e deixa o banco intacto", async () => {
    fs.rmSync(path.join(dir, "trips.txt"));
    await expect(importGtfs(client, dir, SCHEMA)).rejects.toThrow(/trips\.txt/);
    expect(await count("stops")).toBe(2);
  });
});
