const db = require("../config/db");

const examAttemptModel = {
  /**
   * Create a new exam attempt record.
   * Returns the new attempt's insertId.
   */
  createAttempt: async ({ user_id, exam_id, total_marks }) => {
    const sql = `
      INSERT INTO exam_attempts
        (user_id, exam_id, total_marks, start_time, status)
      VALUES
        (?, ?, ?, NOW(), 'in_progress')
    `;
    const [result] = await db.execute(sql, [user_id, exam_id, total_marks]);
    return result.insertId;
  },

  /**
   * Fetch a single attempt by ID.
   */
  getAttemptById: async (attempt_id) => {
    const sql = `
      SELECT
        ea.id,
        ea.user_id,
        ea.exam_id,
        ea.total_marks,
        ea.score,
        ea.percentage,
        ea.correct_count,
        ea.wrong_count,
        ea.unanswered_count,
        ea.status,
        ea.passed,
        ea.start_time,
        ea.end_time,
        ea.created_at
      FROM exam_attempts ea
      WHERE ea.id = ?
    `;
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
    const sql = `
      UPDATE exam_attempts
      SET
        score             = ?,
        percentage        = ?,
        correct_count     = ?,
        wrong_count       = ?,
        unanswered_count  = ?,
        passed            = ?,
        status            = 'submitted',
        end_time          = NOW()
      WHERE id = ?
    `;
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
    const sql = `
      SELECT 
        ea.id, 
        ea.exam_id, 
        e.exam_title, 
        e.slug,
        ea.score, 
        ea.total_marks, 
        ea.percentage, 
        ea.passed, 
        ea.status, 
        ea.start_time, 
        ea.end_time
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.user_id = ? AND ea.status = 'submitted'
      ORDER BY ea.end_time DESC
      LIMIT ? OFFSET ?
    `;
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
};

module.exports = examAttemptModel;
