import { type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { stops } from "../db/schema/stops.js";
import { minutesOfDay, nowMinutesFortaleza } from "../db/queries.js";

export const getStops = async (_req: Request, res: Response) => {
  try {
    const allStops = await db.select().from(stops);

    return res.status(200).json({ stops: allStops });
  } catch (err) {
    console.error("Get all stops error:", err);
    return res.status(500).json({ error: "Failed to fetch stops" });
  }
};

export const getStopById = async (req: Request, res: Response) => {
  try {
    const stopId = String(req.params.stopId);

    const [stop] = await db.select().from(stops).where(eq(stops.stopId, stopId));

    if (!stop) {
      return res
        .status(404)
        .json({ error: "couldnt find stop with the provided stopId" });
    }

    return res.status(200).json({ stop });
  } catch (err) {
    console.error("Get stop error:", err);
    return res.status(500).json({ error: "Failed to fetch stop" });
  }
};

export const getStopTimetables = async (req: Request, res: Response) => {
  try {
    const stopId = String(req.params.stopId);
    const direction =
      req.query.directionId === undefined
        ? null
        : Number(req.query.directionId);

    if (direction !== null && !Number.isInteger(direction)) {
      return res.status(400).json({ error: "directionId must be an integer" });
    }

    const limit = Math.min(Math.max(Number(req.query.next) || 5, 1), 20);

    const [stop] = await db.select().from(stops).where(eq(stops.stopId, stopId));

    if (!stop) {
      return res
        .status(404)
        .json({ error: "couldnt find stop with the provided stopId" });
    }

    // sem sentido: grade completa do dia, agrupada por sentido
    if (direction === null) {
      const result = await db.execute(sql`
        SELECT
          t.direction_id AS "directionId",
          TRIM(t.trip_headsign) AS sentido,
          array_agg(LEFT(st.departure_time, 5) ORDER BY st.departure_time) AS horarios
        FROM gtfs_metrofor.stop_times st
        JOIN gtfs_metrofor.trips t ON t.trip_id = st.trip_id
        WHERE st.stop_id = ${stopId}
        GROUP BY t.trip_headsign, t.direction_id
        ORDER BY t.direction_id
      `);
      return res.status(200).json({ stop, timetables: result.rows });
    }

    // com sentido: próximas partidas a partir de agora (fuso de Fortaleza)
    const result = await db.execute(sql`
      SELECT LEFT(st.departure_time, 5) AS horario
      FROM gtfs_metrofor.stop_times st
      JOIN gtfs_metrofor.trips t ON t.trip_id = st.trip_id
      WHERE st.stop_id = ${stopId}
        AND t.direction_id = ${direction}
        AND ${minutesOfDay(sql`st.departure_time`)} >= ${nowMinutesFortaleza}
      ORDER BY st.departure_time
      LIMIT ${limit}
    `);

    return res
      .status(200)
      .json({ stop, nextDepartures: result.rows.map((r) => r.horario) });
  } catch (err) {
    console.error("Get stop timetables error:", err);
    return res.status(500).json({ error: "Failed to fetch timetables" });
  }
};
