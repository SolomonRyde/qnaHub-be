const express = require("express");
const router = express.Router();
const {
  getStagingQuestions,
  removeDuplicates,
  getPushPreview,
  pushDistinct,
  getFinalPushPreview,
  pushFinalDistinct,
  validateAll,
  deleteSingle,
  deleteDuplicates,
  deleteAllStaging,
  deleteByStatus,
} = require("../controllers/stagingController");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");

// ==========================================
// GET & POST ROUTES
// ==========================================
router.get("/", authenticateToken, authorizeAdmin, getStagingQuestions);
router.post(
  "/remove-duplicates",
  authenticateToken,
  authorizeAdmin,
  removeDuplicates,
);
router.get("/push-preview", authenticateToken, authorizeAdmin, getPushPreview);
router.post("/push-distinct", authenticateToken, authorizeAdmin, pushDistinct);
router.post("/validate-all", authenticateToken, authorizeAdmin, validateAll);
router.get(
  "/final-push-preview",
  authenticateToken,
  authorizeAdmin,
  getFinalPushPreview,
);
router.post(
  "/push-final-distinct",
  authenticateToken,
  authorizeAdmin,
  pushFinalDistinct,
);

// ==========================================
// DELETE ROUTES
// ==========================================

// 1️⃣ STATIC ROUTES MUST COME FIRST
router.delete(
  "/duplicates",
  authenticateToken,
  authorizeAdmin,
  deleteDuplicates,
);
router.delete("/all", authenticateToken, authorizeAdmin, deleteAllStaging);
router.delete(
  "/by-status/:status",
  authenticateToken,
  authorizeAdmin,
  deleteByStatus,
);

// 2️⃣ PARAMETERIZED ROUTE MUST BE AT THE VERY BOTTOM
// (If this is placed above /all, Express will treat "all" as an :id)
router.delete("/:id", authenticateToken, authorizeAdmin, deleteSingle);

module.exports = router;
