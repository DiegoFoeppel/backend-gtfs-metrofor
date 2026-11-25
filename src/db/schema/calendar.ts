import {
  pgTable,
  varchar,
  smallint,
  date,
  pgSchema,
} from "drizzle-orm/pg-core";
import { gtfs } from "../index.js";

export const calendar = gtfs.table("calendar", {
  serviceId: varchar("service_id", { length: 50 }).primaryKey(),
  monday: smallint("monday").notNull(),
  tuesday: smallint("tuesday").notNull(),
  wednesday: smallint("wednesday").notNull(),
  thursday: smallint("thursday").notNull(),
  friday: smallint("friday").notNull(),
  saturday: smallint("saturday").notNull(),
  sunday: smallint("sunday").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
});

// export const calendarRelations = relations(calendar, ({ many }) => ({
//   trips: many(trips),
// }));
