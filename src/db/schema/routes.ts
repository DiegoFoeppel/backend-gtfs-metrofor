import {
  pgTable,
  pgSchema,
  varchar,
  text,
  smallint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { trips } from "./index.js";
import { gtfs } from "../index.js";

export const routes = gtfs.table("routes", {
  routeId: varchar("route_id", { length: 50 }).primaryKey(),
  agencyId: varchar("agency_id", { length: 50 }),
  cityId: varchar("city_id", { length: 50 }),
  routeShortName: varchar("route_short_name", { length: 50 }),
  routeLongName: text("route_long_name"),
  routeDesc: text("route_desc"),
  routeType: smallint("route_type").notNull(),
  routeUrl: text("route_url"),
  routeColor: varchar("route_color", { length: 6 }),
  routeTextColor: varchar("route_text_color", { length: 6 }),
});

export const routesRelations = relations(routes, ({ many }) => ({
  trips: many(trips),
}));
