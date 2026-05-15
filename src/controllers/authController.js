const jwt = require("jsonwebtoken");
const Joi = require("joi");
const User = require("../models/userModel");
const { sendOTP, sendResetLink } = require("../utils/mailer");
const { catchAsync, throwError } = require("../utils/errorHandler");
const crypto = require("crypto");

const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Validation schemas
const signUpSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().required(),
  phone_number: Joi.string().length(10).required(),
  country_code: Joi.string().length(3).default("+1").required(),
});

const verifyOTPSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Generate random 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );
};

// Helper function to set auth cookie
const setAuthCookie = (res, token) => {
  res.cookie("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { error, value } = signUpSchema.validate(req.body);
  if (error) throwError(error.details[0].message, 400);

  const { email, password, name, phone_number, country_code } = value;

  const existingUser = await User.findByEmail(email);
  if (existingUser) throwError("Email already registered", 409);

  await User.create({
    email,
    password,
    name,
    phone_number,
    country_code,
    role: "user",
    status: 1,
  });

  const otp = generateOTP();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  const otpLastSent = new Date();

  await User.updateOTP(email, otp, expiry, otpLastSent);

  // console.log(`📧 OTP for ${email}: ${otp}`); // ⭐ Log OTP to console for testing

  await sendOTP(email, otp, name);

  res.status(201).json({
    success: true,
    message:
      "User created. OTP sent to email. Please verify to complete signup.",
    email,
    phone_number,
    ...(process.env.NODE_ENV === "development" && { otp }), // ⭐ Return OTP in development
  });
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { error, value } = verifyOTPSchema.validate(req.body);
  if (error) throwError(error.details[0].message, 400);

  const { email, otp } = value;

  const isValid = await User.verifyOTP(email, otp);
  if (!isValid) throwError("Invalid or expired OTP", 400);

  const user = await User.findByEmail(email);
  const token = generateToken(user);
  setAuthCookie(res, token);

  res.json({
    success: true,
    message: "Email verified successfully. Token generated.",
    email,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) throwError(error.details[0].message, 400);

  const { email, password } = value;

  const user = await User.findByEmail(email);
  if (!user) throwError("Invalid email or password", 401);

  if (!user.is_verified) {
    throwError("Email not verified. Please verify your email first.", 403);
  }

  if (user.is_deleted) {
    throwError("Account has been deleted by admin", 403);
  }

  if (user.status !== 1) {
    throwError("Account is inactive", 403);
  }

  const isMatch = await User.comparePassword(password, user.password);
  if (!isMatch) throwError("Invalid email or password", 401);

  await User.updateLastLogin(user.id);

  // ✅ ALWAYS generate new token
  const token = generateToken(user);
  setAuthCookie(res, token);

  res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
    },
  });
});

exports.resendOTP = async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email } = value;

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.is_verified)
      return res.status(400).json({ error: "Email already verified" });

    // Generate and send new OTP
    const otp = generateOTP();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    const otpLastSent = new Date();

    await User.updateOTP(email, otp, expiry, otpLastSent);
    await sendOTP(email, otp, user.name); // Pass user name here

    res.json({
      message: "OTP resent successfully",
      email,
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    next(err);
  }
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findByEmail(email);
  if (!user) throwError("User not found", 404);

  const token = generateResetToken();
  const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  await User.saveResetToken(email, hashedToken, expiry);
  const FRONTEND_URL =
    process.env.NODE_FRONT_ENV === "production"
      ? process.env.FRONTEND_PROD_URL
      : process.env.FRONTEND_LOCAL_URL; // i want better centralized way to manage frontend urls later #eaff00

  const resetLink = `${FRONTEND_URL}/reset-password/${token}`;

  await sendResetLink(email, resetLink, user.name);

  res.json({
    success: true,
    message: "Password reset link sent to email",
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, new_password } = req.body;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findByResetToken(hashedToken);

  if (!user) throwError("Invalid or expired token", 400);

  await User.updatePassword(user.email, new_password);

  res.json({
    success: true,
    message: "Password reset successful",
  });
});

exports.logout = (req, res) => {
  res.cookie("authToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

exports.getMe = catchAsync(async (req, res) => {
  if (!req.user?.id) {
    throwError("User not authenticated", 401);
  }

  const meUser = await User.findById(req.user.id);

  if (!meUser) {
    throwError("User not found", 404);
  }

  // remove sensitive data
  delete meUser.password;
  delete meUser.otp;
  delete meUser.otp_expiry;
  delete meUser.reset_token;
  delete meUser.reset_token_expiry;

  res.status(200).json({
    success: true,
    user: meUser,
  });
});
