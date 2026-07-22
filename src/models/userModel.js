const pool = require("../config/db");
const bcrypt = require("bcrypt");

exports.findByEmail = (email) =>
  pool
    .query("SELECT * FROM users WHERE email = ?", [email])
    .then(([rows]) => rows[0] || null);

exports.findById = (id) =>
  pool
    .query("SELECT * FROM users WHERE id = ?", [id])
    .then(([rows]) => rows[0] || null);

exports.create = async ({
  email,
  password,
  name,
  phone_number,
  country_code,
  role,
  status,
}) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return pool.execute(
    "INSERT INTO users (email, password, name, phone_number, country_code, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      email,
      hashedPassword,
      name,
      phone_number,
      country_code || "+1",
      role || "user",
      status || 1,
    ],
  );
};

exports.updateOTP = (email, otp, expiry, otpLastSent) =>
  pool.execute(
    "UPDATE users SET otp = ?, otp_expiry = ?, otp_last_sent = ? WHERE email = ?",
    [otp, expiry, otpLastSent, email],
  );

exports.updatePassword = async (email, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.execute(
    `UPDATE users 
     SET password = ?, 
         reset_token = NULL, 
         reset_token_expiry = NULL 
     WHERE email = ?`,
    [hashedPassword, email],
  );
};

exports.verifyOTP = async (email, otp) => {
  const user = await exports.findByEmail(email);
  if (!user) return false;
  if (user.otp !== otp || new Date() > new Date(user.otp_expiry)) return false;

  // Clear OTP and mark as verified
  await pool.execute(
    "UPDATE users SET otp = NULL, otp_expiry = NULL, is_verified = 1 WHERE email = ?",
    [email],
  );
  return true;
};
exports.saveResetToken = (email, token, expiry) => {
  return pool.execute(
    `UPDATE users 
     SET reset_token = ?, reset_token_expiry = ? 
     WHERE email = ?`,
    [token, expiry, email],
  );
};

exports.findByResetToken = async (token) => {
  const [rows] = await pool.execute(
    `SELECT * FROM users 
     WHERE reset_token = ? 
     AND reset_token_expiry > NOW()`,
    [token],
  );

  return rows[0] || null;
};

exports.updateLastLogin = (id) =>
  pool.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [
    id,
  ]);

exports.comparePassword = (password, hashedPassword) =>
  bcrypt.compare(password, hashedPassword);

// Admin stats method #f04c4c

exports.getUserStats = async () => {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) AS total_users,
      SUM(status = 1) AS active_users,
      SUM(status = 0) AS inactive_users,
      SUM(is_verified = 0) AS unverified_users,
      SUM(is_deleted = 1) AS deleted_users,
      SUM(created_at >= NOW() - INTERVAL 7 DAY) AS new_signups_7d
    FROM users
    `);

  return rows[0];
};

exports.getAllUsers = async ({
  page,
  limit,
  search,
  role,
  status,
  verified,
  deleted,
}) => {
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params = [];

  // 🔍 Search (name or email)
  if (search) {
    where += " AND (name LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  // 🎭 Role filter
  if (role) {
    where += " AND role = ?";
    params.push(role);
  }

  // ⚡ Status filter
  if (status !== undefined) {
    where += " AND status = ?";
    params.push(status);
  }

  // 👇 add after status filter
  if (verified !== undefined) {
    where += " AND is_verified = ?";
    params.push(verified);
  }

  if (deleted !== undefined) {
    where += " AND is_deleted = ?";
    params.push(deleted);
  }

  // 📊 Total count
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM users ${where}`,
    params,
  );

  const total = countResult[0].total;

  // 📦 Fetch users
  const [users] = await pool.query(
    `SELECT id, name, email, role, status, last_login, is_deleted, created_at
     FROM users
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: users,
  };
};

// 🟡 SOFT DELETE
exports.softDeleteUser = (id) => {
  return pool
    .execute(
      `UPDATE users 
     SET is_deleted = 1, status = 0 
     WHERE id = ? AND is_deleted = 0`,
      [id],
    )
    .then(([result]) => result);
};

// 🔴 HARD DELETE
exports.hardDeleteUser = (id) => {
  return pool
    .execute(`DELETE FROM users WHERE id = ?`, [id])
    .then(([result]) => result);
};

// 🟡 BULK SOFT DELETE
exports.bulkSoftDeleteUsers = async (userIds) => {
  const [result] = await pool.query(
    `UPDATE users 
     SET is_deleted = 1, status = 0 
     WHERE id IN (?) AND is_deleted = 0`,
    [userIds],
  );

  return result;
};

// 🔴 BULK HARD DELETE
exports.bulkHardDeleteUsers = async (userIds) => {
  const [result] = await pool.query(
    `DELETE FROM users 
     WHERE id IN (?)`,
    [userIds],
  );

  return result;
};

// 🟢 SINGLE RESTORE
exports.restoreUser = async (id) => {
  const [result] = await pool.query(
    `UPDATE users
     SET is_deleted = 0, status = 1
     WHERE id = ? AND is_deleted = 1`,
    [id],
  );

  return result;
};

// 🟢 BULK RESTORE
exports.bulkRestoreUsers = async (userIds) => {
  const [result] = await pool.query(
    `UPDATE users
     SET is_deleted = 0, status = 1
     WHERE id IN (?) AND is_deleted = 1`,
    [userIds],
  );

  return result;
};

exports.getUserById = async (id) => {
  const [rows] = await pool.query(
    `SELECT 
        id,
        name,
        email,
        country_code,
        phone_number,
        role,
        status,
        is_verified,
        is_deleted,
        last_login,
        created_at
     FROM users
     WHERE id = ?`,
    [id],
  );

  return rows[0] || null;
};

exports.getUsersByIds = async (ids) => {
  const [rows] = await pool.query(
    `SELECT id, role FROM users WHERE id IN (?)`,
    [ids],
  );

  return rows;
};

exports.updateUserRole = async (id, role) => {
  const [result] = await pool.query(`UPDATE users SET role = ? WHERE id = ?`, [
    role,
    id,
  ]);

  return result;
};

// ─── Self-service profile management ──────────────────────────────────────

// Check if an email is already taken by a DIFFERENT user (used on email change).
exports.emailExists = async (email, excludeId) => {
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE email = ? AND id != ?",
    [email, excludeId],
  );
  return rows.length > 0;
};

// Update the editable, non-sensitive profile fields.
exports.updateProfile = async (id, { name, phone_number, country_code }) => {
  const [result] = await pool.execute(
    "UPDATE users SET name = ?, phone_number = ?, country_code = ? WHERE id = ?",
    [name, phone_number, country_code, id],
  );
  return result.affectedRows > 0;
};

// Change the account email. Marks the account unverified again since the
// new address hasn't been proven to belong to the user yet — the caller
// is expected to immediately trigger an OTP to the new address.
exports.updateEmail = async (id, newEmail) => {
  const [result] = await pool.execute(
    "UPDATE users SET email = ?, is_verified = 0 WHERE id = ?",
    [newEmail, id],
  );
  return result.affectedRows > 0;
};

exports.setPendingEmail = async (id, email) => {
  const [result] = await pool.execute(
    "UPDATE users SET pending_email = ? WHERE id = ?",
    [email, id],
  );
  return result.affectedRows > 0;
};

exports.getPendingEmail = async (id) => {
  const [rows] = await pool.query(
    "SELECT pending_email FROM users WHERE id = ?",
    [id],
  );
  return rows[0]?.pending_email || null;
};

exports.finalizeEmailChange = async (id) => {
  // Get the pending email first
  const pendingEmail = await exports.getPendingEmail(id);
  if (!pendingEmail) return false;

  // Update the main email, clear pending, and mark as verified
  const [result] = await pool.execute(
    "UPDATE users SET email = ?, pending_email = NULL, is_verified = 1 WHERE id = ?",
    [pendingEmail, id],
  );

  return result.affectedRows > 0;
};

// Modify your existing updateEmail function to NOT update the main email yet
// Rename it to updateEmailRequest to be clear
exports.updateEmailRequest = async (id, newEmail) => {
  // Just store it in pending
  return exports.setPendingEmail(id, newEmail);
};

exports.findByOTP = async (otp) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE otp = ?", [otp]);
  return rows[0] || null;
};

exports.findByPendingEmail = async (email) => {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE pending_email = ?",
    [email],
  );
  return rows[0] || null;
};
