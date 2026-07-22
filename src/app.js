require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");

const industryRoutes = require("./routes/industryRoutes");
const llmQuestionRoutes = require("./routes/llmQuestionRoutes");

const questionRoutes = require("./routes/questionRoutes");
const importRoutes = require("./routes/importRoutes");
const stagingRoutes = require("./routes/stagingRoutes");

const examRoutes = require("./routes/examRoutes");

const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");

const requestLogger = require("./middleware/requestLogger");

const app = express();

app.set("trust proxy", 1);
// built‑in middleware
app.use(express.json());
app.use(cookieParser());

// app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));
app.use("/uploads", express.static("/home/u911106075/uploads"));

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

app.use(
  helmet({
    crossOriginResourcePolicy: false, // To access the image from localhost not to block any requests
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP
  }),
);

app.use(requestLogger);

app.use("/api/v1/llm/questions", llmQuestionRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use("/api/v1/questions", questionRoutes);
app.use("/api/v1/question-imports", importRoutes);
app.use("/api/v1/staging-questions", stagingRoutes);
app.use("/api/v1/exam", examRoutes);

app.use("/api/v1", industryRoutes);

app.use(errorHandler);

module.exports = app;
