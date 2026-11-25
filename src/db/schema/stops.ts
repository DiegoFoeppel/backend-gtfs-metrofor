import {
  pgTable,
  varchar,
  text,
  smallint,
  numeric,
  doublePrecision,
  pgSchema,
} from "drizzle-orm/pg-core";
import { stopTimes } from "./index.js";
import { relations } from "drizzle-orm";
import { gtfs } from "../index.js";

export const stops = gtfs.table("stops", {
  stopId: varchar("stop_id", { length: 50 }).primaryKey(),
  stopCode: varchar("stop_code", { length: 50 }),
  stopName: text("stop_name"),
  stopDesc: text("stop_desc"),
  stopLat: doublePrecision("stop_lat"),
  stopLon: doublePrecision("stop_lon"),
  zoneId: varchar("zone_id", { length: 50 }),
  stopUrl: text("stop_url"),
  locationType: smallint("location_type").default(0),
  parentStation: varchar("parent_station", { length: 50 }),
  stopTimezone: text("stop_timezone"),
  wheelchairBoarding: smallint("wheelchair_boarding").default(0),
});

export const stopsRelations = relations(stops, ({ many }) => ({
  stopTimes: many(stopTimes),
}));
