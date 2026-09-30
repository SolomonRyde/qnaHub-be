const rateLimit = require("express-rate-limit");

/**
 * IP Rate Limiting Middleware
 *
 * Protects authentication endpoints from brute force attacks and abuse.
 * Tracks requests by IP address with time-based windows.
 *
 * Optional Enhancement: For production environments with multiple servers,
 * consider using Redis as a shared store:
 *
 * const RedisStore = require('rate-limit-redis');
 * const redis = require('redis');
 * const redisClient = redis.createClient({ host: 'localhost', port: 6379 });
 *
 * Then add to limiter config:
 * store: new RedisStore({ client: redisClient })
 */

/**
 * Signup Rate Limiter
 *
 * Limits signup attempts to prevent spam account creation.
 * 10 requests per hour per IP address.
 */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per window
  message: {
    success: false,
    message: "Too many signup attempts. Please try again after an hour.",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // skipSuccessfulRequests: false, // Count all requests, not just failed ones
  // skipFailedRequests: false, // Count failed requests too
});

/**
 * OTP Resend Rate Limiter
 *
 * Prevents OTP resend abuse and SMS/email flooding.
 * 5 requests per hour per IP address.
 */
const otpResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: "Too many OTP resend requests. Please try again after an hour.",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // skipSuccessfulRequests: false, // Count all requests
  // skipFailedRequests: false, // Count failed requests too
});

module.exports = {
  signupLimiter,
  otpResendLimiter,
};
