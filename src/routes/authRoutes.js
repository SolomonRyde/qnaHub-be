const express = require("express");
const router = express.Router();
const {
  signup,
  verifyOTP,
  login,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  updateProfile,
  updateEmail,
  changePassword,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth");

router.post("/signup", signup);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);

router.get("/me", authenticateToken, getMe);

// ─── Self-service account management ──────────────────────────────────────
router.patch("/profile", authenticateToken, updateProfile);
router.patch("/email", authenticateToken, updateEmail);
router.patch("/password", authenticateToken, changePassword);

module.exports = router;
