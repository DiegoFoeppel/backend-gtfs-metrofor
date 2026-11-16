import express from "express";
import cors from "cors";
import metroRoutes from "./routes/metroRoutes.js";
import stopsRoutes from "./routes/stopsRoutes.js";

const app = express();

app.use(cors());

app.use("/api/routes", metroRoutes);
app.use("/api/stops", stopsRoutes);

// app.use("/api/stops");

export { app };
export default app;
