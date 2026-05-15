const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  uploadToStaging,
  getHistory,
  getImportDetails,
} = require("../controllers/importController");
const { authorizeAdmin, authenticateToken } = require("../middleware/auth");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  "/staging",
  upload.single("file"),
  authenticateToken,
  authorizeAdmin,
  uploadToStaging,
);
router.get("/", authenticateToken, authorizeAdmin, getHistory);
router.get("/:import_id", authenticateToken, authorizeAdmin, getImportDetails);

module.exports = router;
