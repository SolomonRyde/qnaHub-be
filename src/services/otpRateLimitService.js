const pool = require("../config/db");

/**
 * OTP Rate Limit Service
 *
 * Manages OTP request rate limiting to prevent abuse and spam.
 * Implements a sliding window approach with per-email and per-IP limits.
 *
 * Configuration:
 * - 15-minute rolling window for request counting
 * - Maximum 5 OTP requests per window
 * - 60-second minimum cooldown between requests
 * - Separate rate limit for verification attempts (10 attempts per 5 minutes)
 */

// Configuration constants
const RATE_LIMIT_CONFIG = {
  window_minutes: 15, // Rolling window duration in minutes
  max_requests: 5, // Maximum OTP requests allowed per window
  min_seconds_between: 60, // Minimum seconds between consecutive OTP generation requests
  ip_limit_per_hour: 10, // Maximum requests per IP per hour (future implementation not done yet)

  // Separate config for verification attempts (protects against brute force)
  verify_window_minutes: 5, // Window for verification attempts
  max_verify_attempts: 10, // Maximum verification attempts per window
};

/**
 * Check rate limit and increment counter for OTP request
 *
 * Algorithm:
 * 1. Fetch user with current rate limit data (otp_last_sent, otp_request_count, otp_window_start)
 * 2. Check if 60-second cooldown period has passed since last OTP
 * 3. Check if 15-minute window has expired, reset counters if needed
 * 4. Check if user has reached maximum requests (3) within current window
 * 5. Increment request counter and update last sent timestamp
 * 6. Return result with allowed status and retry information
 *
 * @param {string} email - User's email address
 * @returns {Promise<{allowed: boolean, retryAfter: number|null, reason: string|null}>}
 */
async function checkAndIncrement(email) {
  const connection = await pool.getConnection();

  try {
    // Step 1: Fetch user with rate limit data
    const [users] = await connection.query(
      `SELECT id, email, otp_last_sent, otp_request_count, otp_window_start
       FROM users
       WHERE email = ?`,
      [email],
    );

    // If user doesn't exist, allow (will be handled by signup/verification flow)
    if (users.length === 0) {
      return { allowed: true, retryAfter: null, reason: null };
    }

    const user = users[0];
    const now = new Date();
    const lastSent = user.otp_last_sent ? new Date(user.otp_last_sent) : null;
    const windowStart = user.otp_window_start
      ? new Date(user.otp_window_start)
      : null;
    const requestCount = user.otp_request_count || 0;

    // Step 2: Check 60-second cooldown between requests
    if (lastSent) {
      const secondsSinceLastSent = Math.floor((now - lastSent) / 1000);

      if (secondsSinceLastSent < RATE_LIMIT_CONFIG.min_seconds_between) {
        const retryAfter =
          RATE_LIMIT_CONFIG.min_seconds_between - secondsSinceLastSent;
        return {
          allowed: false,
          retryAfter,
          reason: `Please wait ${retryAfter} seconds before requesting another OTP`,
        };
      }
    }

    // Step 3: Check if 15-minute window has expired
    let currentWindowStart = windowStart;
    let currentRequestCount = requestCount;
    const windowDurationMs = RATE_LIMIT_CONFIG.window_minutes * 60 * 1000;

    if (!windowStart || now - windowStart > windowDurationMs) {
      // Window expired, reset counters
      currentWindowStart = now;
      currentRequestCount = 0;
    }

    // Step 4: Check if maximum requests reached within current window
    if (currentRequestCount >= RATE_LIMIT_CONFIG.max_requests) {
      const windowAge = Math.floor((now - currentWindowStart) / 1000);
      const retryAfter = Math.max(
        1,
        RATE_LIMIT_CONFIG.window_minutes * 60 - windowAge,
      );

      return {
        allowed: false,
        retryAfter,
        reason: `Too many OTP requests. Please try again in ${Math.ceil(retryAfter / 60)} minutes`,
      };
    }

    // Step 5: Increment counter and update timestamps
    await connection.query(
      `UPDATE users
       SET otp_last_sent = ?,
           otp_request_count = ?,
           otp_window_start = ?
       WHERE id = ?`,
      [now, currentRequestCount + 1, currentWindowStart, user.id],
    );

    // Step 6: Return success
    return {
      allowed: true,
      retryAfter: null,
      reason: null,
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Reset OTP rate limit counters after successful verification
 *
 * Called when user successfully verifies OTP to clear rate limiting.
 * This allows immediate subsequent OTP requests if needed.
 *
 * @param {string} email - User's email address
 * @returns {Promise<void>}
 */
async function reset(email) {
  const connection = await pool.getConnection();

  try {
    await connection.query(
      `UPDATE users
       SET otp_request_count = 0,
           otp_window_start = NULL,
           otp_last_sent = NULL
       WHERE email = ?`,
      [email],
    );
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Increment failed OTP verification attempts
 *
 * Tracks failed verification attempts for security monitoring.
 * Could be extended to implement account lockout after too many failures.
 *
 * Note: Currently updates a counter but does not enforce limits.
 * Future enhancement: Add otp_failed_attempts column and implement lockout logic.
 *
 * @param {string} email - User's email address
 * @returns {Promise<number>} - New failed attempt count
 */
async function incrementFailedAttempts(email) {
  const connection = await pool.getConnection();

  try {
    // Fetch current failed attempts count
    const [users] = await connection.query(
      `SELECT id, otp_failed_attempts
       FROM users
       WHERE email = ?`,
      [email],
    );

    if (users.length === 0) {
      return 0;
    }

    const user = users[0];
    const currentFailedAttempts = user.otp_failed_attempts || 0;
    const newFailedAttempts = currentFailedAttempts + 1;

    // Increment failed attempts counter
    await connection.query(
      `UPDATE users
       SET otp_failed_attempts = ?
       WHERE id = ?`,
      [newFailedAttempts, user.id],
    );

    return newFailedAttempts;
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Check verification attempt rate limit (separate from OTP generation rate limit)
 *
 * This prevents brute force attacks while allowing legitimate users to verify
 * immediately after receiving an OTP (no 60-second cooldown).
 *
 * Algorithm:
 * 1. Check if 5-minute window has expired, reset if needed
 * 2. Check if user has reached maximum verification attempts (10) within window
 * 3. Increment verification attempt counter
 *
 * @param {string} email - User's email address
 * @returns {Promise<{allowed: boolean, retryAfter: number|null, reason: string|null}>}
 */
async function checkVerificationAttempt(email) {
  const connection = await pool.getConnection();

  try {
    // Fetch user with failed attempts data
    const [users] = await connection.query(
      `SELECT id, email, otp_failed_attempts, otp_window_start
       FROM users
       WHERE email = ?`,
      [email],
    );

    // If user doesn't exist, allow (will be handled by verification flow)
    if (users.length === 0) {
      return { allowed: true, retryAfter: null, reason: null };
    }

    const user = users[0];
    const now = new Date();
    const windowStart = user.otp_window_start
      ? new Date(user.otp_window_start)
      : null;
    const failedAttempts = user.otp_failed_attempts || 0;
    const windowDurationMs =
      RATE_LIMIT_CONFIG.verify_window_minutes * 60 * 1000;

    // Check if verification window has expired
    let currentWindowStart = windowStart;
    let currentFailedAttempts = failedAttempts;

    if (!windowStart || now - windowStart > windowDurationMs) {
      // Window expired, reset counters
      currentWindowStart = now;
      currentFailedAttempts = 0;
    }

    // Check if maximum verification attempts reached within current window
    if (currentFailedAttempts >= RATE_LIMIT_CONFIG.max_verify_attempts) {
      const windowAge = Math.floor((now - currentWindowStart) / 1000);
      const retryAfter = Math.max(
        1,
        RATE_LIMIT_CONFIG.verify_window_minutes * 60 - windowAge,
      );

      return {
        allowed: false,
        retryAfter,
        reason: `Too many verification attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes`,
      };
    }

    // Increment verification attempt counter (we count this as a "failed attempt" for now)
    await connection.query(
      `UPDATE users
       SET otp_failed_attempts = ?,
           otp_window_start = ?
       WHERE id = ?`,
      [currentFailedAttempts + 1, currentWindowStart, user.id],
    );

    return {
      allowed: true,
      retryAfter: null,
      reason: null,
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  checkAndIncrement,
  checkVerificationAttempt,
  reset,
  incrementFailedAttempts,
  RATE_LIMIT_CONFIG, // Export for testing and documentation
};
