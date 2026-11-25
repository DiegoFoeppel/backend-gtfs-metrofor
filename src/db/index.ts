import { drizzle } from "drizzle-orm/node-postgres";
import "dotenv/config";
import { pgSchema } from "drizzle-orm/pg-core";

export const gtfs = pgSchema("gtfs_metrofor");

export const db = drizzle(process.env.DATABASE_URL!);
