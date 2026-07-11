const db = require("../config/db");

const userAnswerModel = {
  /**
   * Bulk-insert all user answers for an attempt.
   * `answers` is an array of { attempt_id, question_id, selected_answer, is_correct }
   */
  insertAnswers: async (answers) => {
    if (!answers.length) return 0;

    const placeholders = answers.map(() => "(?, ?, ?, ?)").join(", ");

    const sql = `
      INSERT INTO user_answers
        (attempt_id, question_id, selected_answer, is_correct)
      VALUES
        ${placeholders}
    `;

    const values = answers.flatMap(
      ({ attempt_id, question_id, selected_answer, is_correct }) => [
        attempt_id,
        question_id,
        selected_answer,
        is_correct ? 1 : 0,
      ],
    );

    const [result] = await db.execute(sql, values);
    return result.affectedRows;
  },

  /**
   * Retrieve all answers for a given attempt (used on the review/result page).
   */
  getAnswersByAttempt: async (attempt_id) => {
    const sql = `
      SELECT
        ua.id,
        ua.attempt_id,
        ua.question_id,
        ua.selected_answer,
        ua.is_correct,
        ua.created_at,
        q.question,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_answer,
        q.explanation
      FROM user_answers ua
      JOIN questions q ON q.id = ua.question_id
      WHERE ua.attempt_id = ?
      ORDER BY ua.id ASC
    `;
    const [rows] = await db.execute(sql, [attempt_id]);
    return rows;
  },
};

module.exports = userAnswerModel;
