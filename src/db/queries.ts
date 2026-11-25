import { sql, type SQL } from "drizzle-orm";
import { db } from "./index.js";

// "HH:MM:SS" (aceita 24h+) -> minutos desde a meia-noite
export const minutesOfDay = (column: SQL) =>
  sql`(split_part(${column}, ':', 1)::int * 60 + split_part(${column}, ':', 2)::int)`;

// minuto atual em America/Fortaleza (independe do fuso do servidor/banco)
export const nowMinutesFortaleza = sql`(
  EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Fortaleza')::int * 60 +
  EXTRACT(MINUTE FROM now() AT TIME ZONE 'America/Fortaleza')::int
)`;

export const getShape = async (routeId: string) =>
  db.execute(sql`
            SELECT jsonb_build_object(
        'features',
        jsonb_agg(
        to_jsonb(t) - 'wkb_geometry'||
        jsonb_build_object(
            'coordinates',
            (
            SELECT jsonb_agg(
                jsonb_build_object(
                'latitude', ST_Y(p.geom),
                'longitude', ST_X(p.geom)
                )
            )
            FROM ST_DumpPoints(ST_Transform(t.wkb_geometry, 4326)) AS p
            )
        )
        )
    )
    FROM gtfs_metrofor.linhas_metro t
    where route_id = ${routeId};
    `);

export const getDirections = async (routeId: string) => {
  const result = await db.execute(sql`
    SELECT DISTINCT direction_id AS "id", trip_headsign AS label
    FROM gtfs_metrofor.trips
    WHERE route_id = ${routeId}
    ORDER BY direction_id
  `);
  return result.rows;
};

// paradas de um sentido, usando a trip mais completa
export const getStops = async (routeId: string, directionId: number) => {
  const result = await db.execute(sql`
    WITH best_trip AS (
      SELECT t.trip_id
      FROM gtfs_metrofor.trips t
      JOIN gtfs_metrofor.stop_times st ON st.trip_id = t.trip_id
      WHERE t.route_id = ${routeId}
        AND t.direction_id = ${directionId}
      GROUP BY t.trip_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
    SELECT
      s.stop_id   AS "stopId",
      s.stop_name AS "stopName",
      s.stop_code AS "stopCode",
      s.stop_lat  AS "stopLat",
      s.stop_lon  AS "stopLon"
    FROM gtfs_metrofor.stop_times st
    JOIN gtfs_metrofor.stops s ON s.stop_id = st.stop_id
    WHERE st.trip_id = (SELECT trip_id FROM best_trip)
    ORDER BY st.stop_sequence
  `);
  return result.rows;
};

// export const getStops = async (routeId: string) => {
//   const [trip] = await db
//     .select()
//     .from(trips)
//     .where(eq(trips.routeId, routeId))
//     .limit(1);

//   console.log("trip", trip.directionId);

//   const stops = await db.execute(sql`SELECT
//         s.stop_id as "stopId",
//         s.stop_name as "stopName",
//         s.stop_code as "stopCode",
//         s.stop_lat as "stopLat",
//         s.stop_lon as "stopLon"
//         -- t.direction_id as "directionId"
//         FROM gtfs_metrofor.stop_times st
//         JOIN gtfs_metrofor.stops s
//         ON s.stop_id = st.stop_id
//         JOIN gtfs_metrofor.trips t
//         ON t.trip_id = st.trip_id
//         JOIN gtfs_metrofor.routes r
//         ON r.route_id = t.route_id
//         WHERE t.route_id = ${routeId}
//         AND t.trip_id = ${trip.tripId}
//         AND t.direction_id = '0'
//         ORDER BY st.stop_sequence;`);

//   return stops.rows;
// };
