require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const industryRoutes = require("./routes/industryRouter");
const llmQuestionRoutes = require("./routes/llmQuestionRoutes");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const cookieParser = require("cookie-parser");

const app = express();

app.set("trust proxy", 1);
// built‑in middleware
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "https://qnahub.rydevalues.cloud",
];

// security middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (process.env.NODE_ENV === "development") {
        console.log("Origin:", origin);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(helmet());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP
  }),
);

app.use("/api/v1/llm/questions", llmQuestionRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use("/api/v1", industryRoutes);

app.use(errorHandler);

module.exports = app;
