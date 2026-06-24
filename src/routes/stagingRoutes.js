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
} = require("../controllers/stagingController");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");

router.get("/", authenticateToken, authorizeAdmin, getStagingQuestions);
router.post(
  "/remove-duplicates",
  authenticateToken,
  authorizeAdmin,
  removeDuplicates,
);
router.get("/push-preview", authenticateToken, authorizeAdmin, getPushPreview);
router.post("/push-distinct", authenticateToken, authorizeAdmin, pushDistinct);

// NEW ROUTES

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

module.exports = router;
