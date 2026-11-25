import { Router } from "express";
import {
  getStops,
  getStopById,
  getStopTimetables,
} from "../controller/stopsController.js";

const router = Router();

// pega todas as rotas
router.get("/", getStops);
router.get("/:stopId", getStopById);
router.get("/:stopId/timetables", getStopTimetables);

export default router;
