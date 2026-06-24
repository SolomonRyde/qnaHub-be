const db = require("../config/db");

const llmModel = {
  // --- Daily Stats ---
  getDailyStats: async (date) => {
    const [rows] = await db.execute(
      "SELECT * FROM llm_daily_stats WHERE stat_date = ?",
      [date],
    );
    return rows[0] || null;
  },
  createDailyStats: async (date) => {
    // INSERT IGNORE prevents race conditions if two requests hit simultaneously
    const [result] = await db.execute(
      "INSERT IGNORE INTO llm_daily_stats (stat_date) VALUES (?)",
      [date],
    );
    return result.insertId;
  },
  updateDailyStats: async (date, stats) => {
    const query = `
      UPDATE llm_daily_stats 
      SET 
        total_requests = total_requests + ?,
        successful_generations = successful_generations + ?,
        failed_generations = failed_generations + ?,
        prompt_tokens = prompt_tokens + ?,
        output_tokens = output_tokens + ?,
        total_tokens = total_tokens + ?
      WHERE stat_date = ?
    `;
    const values = [
      stats.total_requests || 0,
      stats.successful_generations || 0,
      stats.failed_generations || 0,
      stats.prompt_tokens || 0,
      stats.output_tokens || 0,
      stats.total_tokens || 0,
      date,
    ];
    const [result] = await db.execute(query, values);

    // Fallback if row didn't exist (race condition safety)
    if (result.affectedRows === 0) {
      await db.execute(
        "INSERT IGNORE INTO llm_daily_stats (stat_date) VALUES (?)",
        [date],
      );
      await db.execute(query, values);
    }
  },

  // --- Overall Stats ---
  getOverallStats: async () => {
    const [rows] = await db.execute("SELECT * FROM llm_overall_stats LIMIT 1");
    if (rows.length === 0) {
      await db.execute(
        "INSERT INTO llm_overall_stats (total_questions_generated) VALUES (0)",
      );
      return { total_questions_generated: 0 };
    }
    return rows[0];
  },
  updateOverallStats: async (questionsGenerated) => {
    await db.execute(
      "UPDATE llm_overall_stats SET total_questions_generated = total_questions_generated + ?",
      [questionsGenerated],
    );
  },

  // --- Generation History ---
  createGenerationHistory: async (data) => {
    const query = `
      INSERT INTO llm_generation_history 
      (exam_id, difficulty, question_count, model_used, generated_by_user_id, generated_by_name, 
       prompt_tokens, output_tokens, total_tokens, file_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      data.exam_id,
      data.difficulty,
      data.question_count,
      data.model_used,
      data.generated_by_user_id,
      data.generated_by_name,
      data.prompt_tokens,
      data.output_tokens,
      data.total_tokens,
      data.file_id,
      data.status,
    ];
    const [result] = await db.execute(query, values);
    return result.insertId;
  },

  // --- Generated Files ---
  createGeneratedFile: async (data) => {
    const query = `
      INSERT INTO generated_question_files 
      (exam_id, exam_title, difficulty, question_count, llm_model, 
       generated_by_user_id, generated_by_name, file_name, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      data.exam_id,
      data.exam_title,
      data.difficulty,
      data.question_count,
      data.llm_model,
      data.generated_by_user_id,
      data.generated_by_name,
      data.file_name,
      data.file_path,
    ];
    const [result] = await db.execute(query, values);
    return result.insertId;
  },
  getGeneratedFiles: async () => {
    const [rows] = await db.execute(
      "SELECT * FROM generated_question_files ORDER BY created_at DESC",
    );
    return rows;
  },
  getGeneratedFileById: async (id) => {
    const [rows] = await db.execute(
      "SELECT * FROM generated_question_files WHERE id = ?",
      [id],
    );
    return rows[0];
  },
  deleteGeneratedFile: async (id) => {
    const [result] = await db.execute(
      "DELETE FROM generated_question_files WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  },
  getMaxSerial: async () => {
    const [rows] = await db.execute(
      "SELECT MAX(id) as max_id FROM generated_question_files",
    );
    return rows[0].max_id || 0;
  },
};

module.exports = llmModel;
