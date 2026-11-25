import { Request, Response } from "express";
import { db, gtfs } from "../db/index.js";
import { stops } from "../db/schema/stops.js";
import { eq, sql } from "drizzle-orm";
import { trips } from "../db/schema/trips.js";
import { routes } from "../db/schema/index.js";

export const getStops = async (req: Request, res: Response) => {
  try {
    const allStops = await db.select().from(stops);

    return res.status(200).json({ stops: allStops });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ error: err });
  }
};

export const getStopById = async (req: Request, res: Response) => {
  try {
    const stopId = String(req.params.stopId);

    const [stop] = await db
      .select()
      .from(stops)
      .fullJoin(routes, eq(stops.stopId, routes.routeId))
      .where(eq(stops.stopId, stopId));

    if (!stop) {
      res
        .status(404)
        .json({ error: "couldnt find stop with the provided stopId" });
    }

    res.status(200).send({
      stop,
    });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ error: err });
  }
};

export const getStopTimetables = async (req: Request, res: Response) => {
  try {
    console.log("req", req.query);

    const stopId = String(req.params.stopId);
    const direction = Number(req.query.directionId);

    console.log("dsna", direction);
    const next = Number(req.query.next ?? 3);
    const from = String(req.query.from ?? "00:00");

    const [stop] = await db
      .select()
      .from(stops)
      .where(eq(stops.stopId, stopId));

    if (!stop) {
      res
        .status(404)
        .json({ error: "couldnt find stop with the provided stopId" });
    }

    if (Number.isNaN(direction)) {
      const result = await db.execute(sql`
            SELECT
          direction_id as "directionId",
          trip_headsign as sentido,
          array_agg(LEFT(departure_time, 5) ORDER BY departure_time) AS horarios
      FROM gtfs_metrofor.stop_times 
      JOIN gtfs_metrofor.trips t 
          ON t.trip_id = stop_times.trip_id
      WHERE stop_id = ${stopId}
      GROUP BY 
          trip_headsign, direction_id;
      `);
      return res.status(200).json({ stop, timetables: result.rows });
    }

    const result = await db.execute(sql`
        SELECT LEFT(st.departure_time, 5) AS horario
        FROM gtfs_metrofor.stop_times st
        JOIN gtfs_metrofor.trips t ON t.trip_id = st.trip_id
        WHERE st.stop_id = ${stopId}
          AND t.direction_id = ${direction}
          AND LEFT(st.departure_time, 5)::TIME >= CURRENT_TIME
        ORDER BY st.departure_time
        LIMIT 5
    `);
    return res
      .status(200)
      .json({ stop, nextDepartures: result.rows.map((r) => r.horario) });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ error: err });
  }
};
