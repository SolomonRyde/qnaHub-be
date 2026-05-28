const express = require("express");
const router = express.Router();

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

const { upload } = require("../middleware/uploadMiddleware.js");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth.js");

// Public routes
router.get("/", getAllExams);
router.get("/slug/:slug", getExamBySlug);
router.get("/industries", getIndustries);
router.get("/categories", getCategories);
router.get("/subcategories", getSubcategories);

// Admin routes - all require auth + admin
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

// ✅ Simple direct delete - permanently removes from DB
router.delete("/:id", authenticateToken, authorizeAdmin, deleteExam);

// Individual status update (no bulk)
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeAdmin,
  updateExamStatus,
);

// Individual featured toggle (no bulk)
router.patch(
  "/:id/featured",
  authenticateToken,
  authorizeAdmin,
  toggleFeaturedExam,
);

// Analytics
router.get("/analytics", authenticateToken, authorizeAdmin, getAnalytics);

module.exports = router;
