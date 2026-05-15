const express = require("express");
const router = express.Router();
const {
  getStagingQuestions,
  removeDuplicates,
  getPushPreview,
  pushDistinct,
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

module.exports = router;
