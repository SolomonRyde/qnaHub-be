const db = require("../config/db");

/**
 * Helper: Builds the WHERE clause and values array for admin filters.
 * Used by both getAllAttemptsAdmin and exportAttemptsAdmin to ensure consistency.
 */
const _buildAdminFilters = ({
  search = "",
  status = null,
  passed = null,
  examId = null,
  startDate = null,
  endDate = null,
}) => {
  let query = " WHERE 1=1";
  const values = [];

  if (status) {
    query += " AND ea.status = ?";
    values.push(status);
  }
  if (passed !== null) {
    query += " AND ea.passed = ?";
    values.push(passed ? 1 : 0);
  }
  if (examId) {
    query += " AND ea.exam_id = ?";
    values.push(examId);
  }
  if (search) {
    query += " AND (u.name LIKE ? OR u.email LIKE ? OR e.exam_title LIKE ?)";
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  // Date Filtering Logic
  if (startDate) {
    query += " AND DATE(ea.created_at) >= ?";
    values.push(startDate);
  }
  if (endDate) {
    // Include the entire end day by adding time 23:59:59 or using <= next day
    // Here we assume input is YYYY-MM-DD. We want to include the whole day.
    query += " AND DATE(ea.created_at) <= ?";
    values.push(endDate);
  }

  return { query, values };
};

const examAttemptModel = {
  /**
   * Create a new exam attempt record.
   * Returns the new attempt's insertId.
   */
  createAttempt: async ({ user_id, exam_id, total_marks }) => {
    const sql = `INSERT INTO exam_attempts (user_id, exam_id, total_marks, start_time, status) VALUES (?, ?, ?, NOW(), 'in_progress')`;
    const [result] = await db.execute(sql, [user_id, exam_id, total_marks]);
    return result.insertId;
  },

  /**
   * Fetch a single attempt by ID.
   */
  getAttemptById: async (attempt_id) => {
    const sql = `SELECT ea.id, ea.user_id, ea.exam_id, ea.total_marks, ea.score, ea.percentage, ea.correct_count, ea.wrong_count, ea.unanswered_count, ea.status, ea.passed, ea.start_time, ea.end_time, ea.created_at FROM exam_attempts ea WHERE ea.id = ?`;
    const [rows] = await db.execute(sql, [attempt_id]);
    return rows[0] || null;
  },

  /**
   * Update the attempt with evaluated results and mark as submitted.
   */
  updateAttemptResult: async (
    attempt_id,
    { score, percentage, correct_count, wrong_count, unanswered_count, passed },
  ) => {
    const sql = `UPDATE exam_attempts SET score = ?, percentage = ?, correct_count = ?, wrong_count = ?, unanswered_count = ?, passed = ?, status = 'submitted', end_time = NOW() WHERE id = ?`;
    const [result] = await db.execute(sql, [
      score,
      percentage,
      correct_count,
      wrong_count,
      unanswered_count,
      passed ? 1 : 0,
      attempt_id,
    ]);
    return result.affectedRows > 0;
  },

  /**
   * Fetch paginated exam attempts for a specific user.
   * Joins with 'exams' table to get the title and slug.
   */
  getUserAttempts: async (userId, limit, offset) => {
    const sql = `SELECT ea.id, ea.exam_id, e.exam_title, e.slug, ea.score, ea.total_marks, ea.percentage, ea.passed, ea.status, ea.start_time, ea.end_time FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id WHERE ea.user_id = ? AND ea.status = 'submitted' ORDER BY ea.end_time DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.execute(sql, [userId, limit, offset]);
    return rows;
  },

  /**
   * Count total submitted attempts for a user.
   */
  countUserAttempts: async (userId) => {
    const sql = `SELECT COUNT(*) as total FROM exam_attempts WHERE user_id = ? AND status = 'submitted'`;
    const [rows] = await db.execute(sql, [userId]);
    return rows[0].total;
  },

  /**
   * ─── ADMIN ──────────────────────────────────────────────────────────────
   * Fetch a paginated, filterable, sortable list of EVERY user's exam
   * attempts, joined with user + exam info. Powers the admin "Attempts"
   * dashboard page.
   */
  getAllAttemptsAdmin: async ({
    limit,
    offset,
    search = "",
    status = null,
    passed = null,
    examId = null,
    sort = "created_at:desc",
    startDate = null,
    endDate = null,
  }) => {
    // Use shared filter builder
    const { query: whereClause, values: filterValues } = _buildAdminFilters({
      search,
      status,
      passed,
      examId,
      startDate,
      endDate,
    });

    let query = `SELECT ea.id, ea.user_id, u.name AS user_name, u.email AS user_email, ea.exam_id, e.exam_title, e.slug, e.difficulty, ea.score, ea.total_marks, ea.percentage, ea.correct_count, ea.wrong_count, ea.unanswered_count, ea.status, ea.passed, ea.start_time, ea.end_time, ea.created_at FROM exam_attempts ea JOIN users u ON u.id = ea.user_id JOIN exams e ON e.id = ea.exam_id ${whereClause}`;

    const values = [...filterValues];

    switch (sort) {
      case "created_at:asc":
        query += " ORDER BY ea.created_at ASC";
        break;
      case "created_at:desc":
        query += " ORDER BY ea.created_at DESC";
        break;
      case "percentage:asc":
        query += " ORDER BY ea.percentage ASC";
        break;
      case "percentage:desc":
        query += " ORDER BY ea.percentage DESC";
        break;
      case "user_name:asc":
        query += " ORDER BY u.name ASC";
        break;
      case "user_name:desc":
        query += " ORDER BY u.name DESC";
        break;
      default:
        query += " ORDER BY ea.created_at DESC";
    }

    query += " LIMIT ? OFFSET ?";
    values.push(limit, offset);

    const [rows] = await db.execute(query, values);
    return rows;
  },

  /**
   * Count all attempts matching the same admin filters (for pagination).
   */
  countAllAttemptsAdmin: async ({
    search = "",
    status = null,
    passed = null,
    examId = null,
    startDate = null,
    endDate = null,
  }) => {
    // Use shared filter builder
    const { query: whereClause, values } = _buildAdminFilters({
      search,
      status,
      passed,
      examId,
      startDate,
      endDate,
    });

    let query = `SELECT COUNT(*) as total FROM exam_attempts ea JOIN users u ON u.id = ea.user_id JOIN exams e ON e.id = ea.exam_id ${whereClause}`;

    const [rows] = await db.execute(query, values);
    return rows[0].total;
  },

  /**
   * Aggregate stats across ALL attempts, used for the stat cards on the
   * admin attempts dashboard.
   */
  getAttemptStatsAdmin: async () => {
    const sql = `SELECT COUNT(*) AS total_attempts, SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_count, SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count, SUM(CASE WHEN status = 'submitted' AND passed = 1 THEN 1 ELSE 0 END) AS passed_count, SUM(CASE WHEN status = 'submitted' AND passed = 0 THEN 1 ELSE 0 END) AS failed_count, AVG(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) AS avg_percentage FROM exam_attempts`;
    const [rows] = await db.execute(sql);
    return rows[0];
  },

  /**
   * Fetch a single attempt (admin view) with user + exam context attached.
   * Used for the attempt detail / answer-review modal.
   */
  getAttemptByIdAdmin: async (attempt_id) => {
    const sql = `SELECT ea.id, ea.user_id, u.name AS user_name, u.email AS user_email, ea.exam_id, e.exam_title, e.slug, ea.total_marks, ea.score, ea.percentage, ea.correct_count, ea.wrong_count, ea.unanswered_count, ea.status, ea.passed, ea.start_time, ea.end_time, ea.created_at FROM exam_attempts ea JOIN users u ON u.id = ea.user_id JOIN exams e ON e.id = ea.exam_id WHERE ea.id = ?`;
    const [rows] = await db.execute(sql, [attempt_id]);
    return rows[0] || null;
  },

  /**
   * ─── EXPORT ──────────────────────────────────────────────────────────────
   * Fetch ALL attempts matching filters (no pagination limit) for Excel export.
   */
  exportAttemptsAdmin: async ({
    search = "",
    status = null,
    passed = null,
    examId = null,
    sort = "created_at:desc",
    startDate = null,
    endDate = null,
  }) => {
    // Use shared filter builder
    const { query: whereClause, values: filterValues } = _buildAdminFilters({
      search,
      status,
      passed,
      examId,
      startDate,
      endDate,
    });

    let query = `SELECT ea.id, ea.user_id, u.name AS user_name, u.email AS user_email, ea.exam_id, e.exam_title, e.slug, e.difficulty, ea.score, ea.total_marks, ea.percentage, ea.correct_count, ea.wrong_count, ea.unanswered_count, ea.status, ea.passed, ea.start_time, ea.end_time, ea.created_at FROM exam_attempts ea JOIN users u ON u.id = ea.user_id JOIN exams e ON e.id = ea.exam_id ${whereClause}`;

    const values = [...filterValues];

    // Apply sorting for export as well
    switch (sort) {
      case "created_at:asc":
        query += " ORDER BY ea.created_at ASC";
        break;
      case "created_at:desc":
        query += " ORDER BY ea.created_at DESC";
        break;
      case "percentage:asc":
        query += " ORDER BY ea.percentage ASC";
        break;
      case "percentage:desc":
        query += " ORDER BY ea.percentage DESC";
        break;
      case "user_name:asc":
        query += " ORDER BY u.name ASC";
        break;
      case "user_name:desc":
        query += " ORDER BY u.name DESC";
        break;
      default:
        query += " ORDER BY ea.created_at DESC";
    }

    const [rows] = await db.execute(query, values);
    return rows;
  },
};

module.exports = examAttemptModel;
