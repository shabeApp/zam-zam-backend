import express from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import { rateLimit } from "express-rate-limit";
import { errorHandler } from "./middleware/error-handler.middleware";
import cookieParser from 'cookie-parser';
// import { apiStatusCode } from "./lib/apiCode.lib";
import rootRouter from "./routes/allRoutes";
import morgan from "morgan";



const app = express();

// ----------------------
// 🌐 1. CORS
// ----------------------
// app.use(cors({
//     origin: ["http://localhost:3000", ],
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
//     credentials: true,
// }));

// ✅ FIXED: Parse FRONTEND_URL correctly
const getAllowedOrigins = () => {
    const allowed = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://khoshil.khoshil-online.workers.dev",
        process.env.FRONTEND_URL!
    ];

    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== "*") {
        // Handle comma-separated URLs
        process.env.FRONTEND_URL.split(",").forEach((url) => {
            const trimmed = url.trim();
            // Validate it's not empty and not a wildcard
            if (trimmed && trimmed !== "*" && trimmed.startsWith("http")) {
                allowed.push(trimmed);
            }
        });
    }
    
    return allowed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. CORS
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    optionsSuccessStatus: 200,
}));



// ======================================================
// 2. 🧾 Body Parser
// (No need for body-parser package now)
// ======================================================
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(cookieParser());

// ======================================================
// 3. 🛡️ Security Middlewares
// ======================================================

//Helmet - Secure Http headers
app.use(helmet());

// Prevent NoSQL injection ($gt, $ne) — rely on Zod validation instead
// express-mongo-sanitize is incompatible with Express 5.x (query property is read-only)

// Prevent HTTP parameter pollution
app.use(hpp());

// ─────────────────────────────────────────────────────────────────────────────
// Global "outer wall" limiter — catches everything before it hits any route.
// Route-level limiters (rateLimiter.middleware.ts) are the precise inner layer.
// Two-layer strategy: global catches floods, per-route catches targeted abuse.
// ─────────────────────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,                                          // 15 min window
    max: process.env.NODE_ENV === "production" ? 100 : 500,           // 100 in prod, 500 in dev
    // max:5,           
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, message: "Too many requests from this IP, please try again later." }
});
app.use(limiter);


// ======================================================
// 4. 📜 logger Handler (Moved up to capture all requests)
// ======================================================
// app.use((req, res, next) => {
//     const start = Date.now();
//     res.on('finish', () => {
//         const duration = Date.now() - start;
//         logger.http(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, { ip: req.ip });
//     });
//     next();
// });



app.use(morgan('dev'));

// ======================================================
// 5. 🚀  Route
// ======================================================
app.use("/api", rootRouter);

// ======================================================
// 6. 🔥 Global Error Handler
// ======================================================
app.use(errorHandler);


export default app;