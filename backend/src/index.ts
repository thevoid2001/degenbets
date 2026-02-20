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
import tradesRouter from "./routes/trades";
import { resolveReadyMarkets } from "./services/resolver";

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
app.use("/api/trades", tradesRouter);

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

// Admin: reset all data (for dev/testing only)
app.post("/api/admin/reset", async (req, res) => {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.AUTHORITY_PRIVATE_KEY?.slice(0, 16)) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { query: dbQuery } = await import("./db/pool");
    await dbQuery("DELETE FROM trades");
    await dbQuery("DELETE FROM resolution_logs");
    await dbQuery("DELETE FROM positions");
    await dbQuery("DELETE FROM markets");
    await dbQuery("DELETE FROM creator_profiles");
    await dbQuery("DELETE FROM user_stats");
    res.json({ success: true, message: "All data cleared" });
  } catch (err) {
    console.error("[admin] Reset error:", err);
    res.status(500).json({ error: "Reset failed" });
  }
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


app.listen(PORT, () => {
  console.log(`[server] DegenBets backend running on port ${PORT}`);
});
