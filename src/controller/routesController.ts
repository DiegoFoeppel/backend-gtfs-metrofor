import { db, gtfs } from "../db/index.js";
import { routes } from "../db/schema/routes.js";
import { type Request, type Response } from "express";
import { sql, eq } from "drizzle-orm";
import { trips } from "../db/schema/trips.js";
import { stops } from "../db/schema/stops.js";
import { getDirections, getShape, getStops } from "../db/queries.js";

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
      res
        .status(404)
        .json({ error: "couldnt find route with the provided routeId" });
    }

    const [directions, stops] = await Promise.all([
      getDirections(String(routeId)),
      getStops(String(routeId), directionId),
    ]);
    res.status(202).json({ directions, stops, route });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ error: err });
  }
};

// export const getShapeByRouteId = async (req: Request, res: Response) => {
//   try {
//     const { routeId } = req.params;

//     const [route] = await db
//       .select({
//         routeId: routes.routeId,
//         routeShortName: routes.routeShortName,
//         routeLongName: sql<string>`TRIM(${routes.routeLongName})`,
//         routeColor: routes.routeColor,
//         routeDesc: routes.routeDesc,
//         routeTextColor: routes.routeTextColor,
//       })
//       .from(routes)
//       .where(eq(routes.routeId, routeId as string));

//     console.log("route", route, routeId);

//     if (!route) {
//       return res
//         .status(404)
//         .json({ error: "couldnt find route with the provided routeId" });
//     }

//     const shape = await getShape(routeId.toString());

//     console.log("shape", shape.rows[0].jsonb_build_object.features);

//     if (!shape.rows[0].jsonb_build_object.features) {
//       return res
//         .status(404)
//         .json({ error: "couldnt find stop with the provided stopId" });
//     }

//     const geojson = shape.rows[0].jsonb_build_object.features[0];

//     const stops = await getStops(routeId.toString());

//     res.status(200).send({
//       shape: geojson,
//       route,
//       stops,
//     });
//   } catch (err) {
//     console.log("err", err);
//     res.status(404).json({ error: err });
//   }
// };

// export const getRoutesAndStops = async (req: Request, res: Response) => {
//   try {
//     // const allRoutes = await db.execute(sql`select * from gtfs_metrofor.linhas`);
//     const allRoutes = await db.execute(sql`
//                 SELECT jsonb_build_object(
//           'features',
//           jsonb_agg(
//             to_jsonb(t) - 'wkb_geometry'||
//             jsonb_build_object(
//               'coordinates',
//               (
//                 SELECT jsonb_agg(
//                   jsonb_build_object(
//                     'latitude', ST_Y(p.geom),
//                     'longitude', ST_X(p.geom)
//                   )
//                 )
//                 FROM ST_DumpPoints(ST_Transform(t.wkb_geometry, 4326)) AS p
//               ),
//           'routeColor', r.route_color,
//           'routeName', r.route_long_name
//             )
//           )
//         )
//         FROM gtfs_metrofor.linhas_metro t
//         JOIN gtfs_metrofor.routes r on r.route_id = t.route_id;
//       `);

//     console.log("all routes", allRoutes);

//     const stopsLine = await db
//       .select({
//         stopId: stops.stopId,
//         stopCode: stops.stopCode,
//         stopName: stops.stopName,
//         stopLat: stops.stopLat,
//         stopLon: stops.stopLon,
//       })
//       .from(stops);

//     if (allRoutes.rows.length === 0) {
//       return res.status(404).json({ error: "Routes not found" });
//     }

//     const geojson = allRoutes.rows[0]?.jsonb_build_object;

//     console.log("geojson", geojson);
//     res.status(200).json({
//       geojson,
//       stopsLine,
//     });
//   } catch (error) {
//     console.error("Get all routes error:", error);
//     res.status(500).json({ error: "Failed to fetch all routes " });
//   }
// };
