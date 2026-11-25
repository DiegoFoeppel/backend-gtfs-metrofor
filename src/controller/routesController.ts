import { db } from "../db/index.js";
import { routes } from "../db/schema/routes.js";
import { type Request, type Response } from "express";
import { sql, eq } from "drizzle-orm";
import { getDirections, getStops } from "../db/queries.js";

export const getCheck = (req: Request, res: Response) => {
  res.status(200).json({
    msg: "working",
  });
};

export const getRoutes = async (req: Request, res: Response) => {
  try {
    const routeLines = await db.select().from(routes);

    res.status(200).json({
      routes: routeLines,
    });
  } catch (error) {
    console.error("Get all routes error:", error);
    res.status(500).json({ error: "Failed to fetch all routes " });
  }
};

export const getRouteById = async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;

    const [route] = await db
      .select({
        routeId: routes.routeId,
        routeShortName: routes.routeShortName,
        routeLongName: sql<string>`TRIM(${routes.routeLongName})`,
        routeColor: routes.routeColor,
        routeDesc: routes.routeDesc,
        routeTextColor: routes.routeTextColor,
      })
      .from(routes)
      .where(eq(routes.routeId, routeId as string));

    // AND direction_id = ${directionId ?? "1"}
    const stops = await db.execute(sql`
      SELECT s.*, st.stop_sequence
      FROM gtfs_metrofor.stop_times st
      JOIN gtfs_metrofor.stops s ON s.stop_id = st.stop_id
      WHERE st.trip_id = (
        SELECT trip_id FROM gtfs_metrofor.trips
        WHERE route_id = ${routeId} 
        LIMIT 1
      )
      ORDER BY st.stop_sequence;
      `);

    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.status(200).json({
      route,
      stops: stops.rows,
    });
  } catch (error) {
    console.error("Error on getting routes", error);
    res.status(500).json({ error: "Error on gettings routes data" });
  }
};

export const getStopsByRouteId = async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const directionId = Number(req.query.directionId ?? 0);

    const [route] = await db
      .select({
        routeId: routes.routeId,
        routeShortName: routes.routeShortName,
        routeLongName: sql<string>`TRIM(${routes.routeLongName})`,
        routeColor: routes.routeColor,
        routeDesc: routes.routeDesc,
        routeTextColor: routes.routeTextColor,
      })
      .from(routes)
      .where(eq(routes.routeId, routeId as string));

    if (!route) {
      return res
        .status(404)
        .json({ error: "couldnt find route with the provided routeId" });
    }

    const [directions, stops] = await Promise.all([
      getDirections(String(routeId)),
      getStops(String(routeId), directionId),
    ]);
    return res.status(200).json({ directions, stops, route });
  } catch (err) {
    console.error("Get route stops error:", err);
    return res.status(500).json({ error: "Failed to fetch route stops" });
  }
};
