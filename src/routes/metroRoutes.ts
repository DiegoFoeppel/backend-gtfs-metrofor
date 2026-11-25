import { Router } from "express";
import {
  getRoutes,
  getRouteById,
  getStopsByRouteId,
  getCheck,
} from "../controller/routesController.js";

const router = Router();

// pega todas as rotas
router.get("/", getRoutes);
router.get("/health", getCheck);
router.get("/:routeId", getRouteById);
router.get("/:routeId/stops", getStopsByRouteId);

// router.get("/:routeId/detailed", getShapeByRouteId);
// router.get("/stops", getRoutesAndStops);

export default router;
