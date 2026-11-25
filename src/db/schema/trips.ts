import {
  pgTable,
  varchar,
  text,
  smallint,
  pgSchema,
} from "drizzle-orm/pg-core";
import { routes, calendar, stopTimes } from "./index.js";
import { relations } from "drizzle-orm";
import { gtfs } from "../index.js";

export const trips = gtfs.table("trips", {
  routeId: varchar("route_id", { length: 50 }),
  serviceId: varchar("service_id", { length: 50 }),
  tripId: varchar("trip_id", { length: 100 }).primaryKey(),
  tripHeadsign: text("trip_headsign"),
  tripShortName: varchar("trip_short_name", { length: 100 }),
  directionId: smallint("direction_id"),
  blockId: varchar("block_id", { length: 50 }),
  shapeId: varchar("shape_id", { length: 100 }),
  wheelchairAccessible: smallint("wheelchair_accessible").default(0),
});

export const tripsRelations = relations(trips, ({ one, many }) => ({
  route: one(routes, {
    fields: [trips.routeId],
    references: [routes.routeId],
  }),
  calendar: one(calendar, {
    fields: [trips.serviceId],
    references: [calendar.serviceId],
  }),
  stopTimes: many(stopTimes),
}));
