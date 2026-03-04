import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

// Security headers
app.use(helmet());

// CORS whitelist
const ALLOWED_ORIGINS = [
  "https://degenbets-a4f.pages.dev",
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://localhost:3001"] : []),
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use(globalLimiter);

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

// Resolution trigger endpoint (protected)
const resolveLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: "Rate limited" } });
app.post("/api/resolve/trigger", resolveLimiter, async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (process.env.RESOLVE_API_KEY && apiKey !== process.env.RESOLVE_API_KEY) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }
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


app.listen(PORT, () => {
  console.log(`[server] MarketMint backend running on port ${PORT}`);
});
