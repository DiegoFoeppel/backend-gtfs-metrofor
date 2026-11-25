import {
  pgTable,
  varchar,
  text,
  smallint,
  integer,
  numeric,
  primaryKey,
  pgSchema,
} from "drizzle-orm/pg-core";
import { trips, stops } from "./index.js";
import { relations } from "drizzle-orm";
import { gtfs } from "../index.js";

export const stopTimes = gtfs.table(
  "stop_times",
  {
    tripId: varchar("trip_id", { length: 100 }).notNull(),
    arrivalTime: text("arrival_time"), // TEXT: GTFS allows times > 24:00:00
    departureTime: text("departure_time"),
    stopId: varchar("stop_id", { length: 50 }).notNull(),
    stopSequence: integer("stop_sequence").notNull(),
    stopHeadsign: text("stop_headsign"),
    pickupType: smallint("pickup_type").default(0),
    dropOffType: smallint("drop_off_type").default(0),
    timepoint: integer("timepoint"),
    shapeDistTraveled: numeric("shape_dist_traveled", {
      precision: 12,
      scale: 4,
    }),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.stopSequence] })],
);

export const stopTimesRelations = relations(stopTimes, ({ one }) => ({
  trip: one(trips, {
    fields: [stopTimes.tripId],
    references: [trips.tripId],
  }),
  stop: one(stops, {
    fields: [stopTimes.stopId],
    references: [stops.stopId],
  }),
}));
