const express = require("express");
const router = express.Router();
// ✅ 1. IMPORT MIDDLEWARE (ONLY ONCE)
const { upload } = require("../middleware/uploadMiddleware.js");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth.js");
// ✅ 2. IMPORT EXAM CONTROLLERS
const {
  createExam,
  getAllExams,
  getExamBySlug,
  getIndustries,
  getCategories,
  getSubcategories,
  getAdminExams,
  updateExam,
  deleteExam,
  updateExamStatus,
  toggleFeaturedExam,
  getAnalytics,
} = require("../controllers/examController.js");
const {
  startExam,
  getExamQuestions,
  submitExam,
  getResult,
  getMyAttempts,
  getAllAttemptsAdmin,
  getAttemptDetailAdmin,
  exportAttemptsAdmin, // Import the new controller
} = require("../controllers/examAttemptController");
// ✅ 3. IMPORT STAGING CONTROLLER (Including uploadAndParseCSV)
const {
  getStagingQuestions,
  removeDuplicates,
  getPushPreview,
  pushDistinct,
  getFinalPushPreview,
  pushFinalDistinct,
  validateAl,
} = require("../controllers/stagingController.js");
// ─── Public routes ─────────────────────────────────────────────────────────────
router.get("/", getAllExams);
router.get("/industries", getIndustries);
router.get("/categories", getCategories);
router.get("/subcategories", getSubcategories);
// ─── Exam attempt routes (authenticated users) ─────────────────────────────────
router.get("/result/:attemptId", authenticateToken, getResult);
router.post("/submit", authenticateToken, submitExam);
router.get("/slug/:slug", getExamBySlug);
router.post("/:id/start", authenticateToken, startExam);
router.get("/:id/questions", authenticateToken, getExamQuestions);
router.get("/my-attempts", authenticateToken, getMyAttempts);
// ─── Admin routes ──────────────────────────────────────────────────────────────
router.post(
  "/",
  authenticateToken,
  authorizeAdmin,
  upload.single("cover_image"),
  createExam,
);
router.get("/admin", authenticateToken, authorizeAdmin, getAdminExams);
router.patch(
  "/:id",
  authenticateToken,
  authorizeAdmin,
  upload.single("cover_image"),
  updateExam,
);
router.delete("/:id", authenticateToken, authorizeAdmin, deleteExam);
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeAdmin,
  updateExamStatus,
);
router.patch(
  "/:id/featured",
  authenticateToken,
  authorizeAdmin,
  toggleFeaturedExam,
);
router.get("/analytics", authenticateToken, authorizeAdmin, getAnalytics);
// ─── Admin: exam attempts dashboard ────────────────────────────────────────
router.get(
  "/admin/attempts",
  authenticateToken,
  authorizeAdmin,
  getAllAttemptsAdmin,
);
// NEW: Export Route (Must be before /:attemptId to avoid conflict)
router.get(
  "/admin/attempts/export",
  authenticateToken,
  authorizeAdmin,
  exportAttemptsAdmin,
);
router.get(
  "/admin/attempts/:attemptId",
  authenticateToken,
  authorizeAdmin,
  getAttemptDetailAdmin,
);
module.exports = router;
