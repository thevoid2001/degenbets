import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import cron from "node-cron";
import marketsRouter from "./routes/markets";
import usersRouter from "./routes/users";
import creatorsRouter from "./routes/creators";
import leaderboardRouter from "./routes/leaderboard";
import syncRouter from "./routes/sync";
import { resolveReadyMarkets } from "./services/resolver";
import { updateCreationFee } from "./services/feeUpdater";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// Routes
app.use("/api/markets", marketsRouter);
app.use("/api/user", usersRouter);
app.use("/api/creator", creatorsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/sync", syncRouter);

// Resolution trigger endpoint
app.post("/api/resolve/trigger", async (_req, res) => {
  try {
    const stats = await resolveReadyMarkets();
    res.json({ success: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resolve] Trigger error:", message);
    res.status(500).json({ error: "Resolution failed" });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Resolution cron - every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("[cron] Running resolution check...");
  try {
    const stats = await resolveReadyMarkets();
    console.log("[cron] Resolution complete:", stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] Resolution error:", message);
  }
});

// Fee update cron - every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  console.log("[cron] Updating creation fee...");
  try {
    const result = await updateCreationFee();
    console.log("[cron] Fee update:", result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] Fee update error:", message);
  }
});

app.listen(PORT, () => {
  console.log(`[server] DegenBets backend running on port ${PORT}`);
});
