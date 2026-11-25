import { Request, Response } from "express";
import { db } from "../db/index.js";
import { cities } from "../db/schema/cities.js";

export const getCities = async (req: Request, res: Response) => {
  try {
    const allCities = await db.select().from(cities);

    res.status(200).json({
      cities: allCities,
    });
  } catch (error) {
    console.error("Get all cities:", error);
    res.status(500).json({ error: "Failed to fetch all cities" });
  }
};
