import { varchar } from "drizzle-orm/pg-core";
import { gtfs } from "../index.js";

export const cities = gtfs.table("cities", {
  cityId: varchar("city_id", { length: 50 }).primaryKey(),
  cityName: varchar("city_name", { length: 50 }).notNull(),
});
