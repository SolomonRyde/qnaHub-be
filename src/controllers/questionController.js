const QuestionModel = require("../models/questionModel");

exports.getAll = async (req, res, next) => {
  try {
    // Parse and validate query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Cap at 100
    const search = req.query.search?.toString().trim() || "";
    const exam_id = req.query.exam_id?.toString().trim() || "";
    const correct_answer =
      req.query.correct_answer?.toString().trim().toUpperCase() || "";
    const from = req.query.from?.toString().trim() || "";
    const to = req.query.to?.toString().trim() || "";
    const difficulty =
      req.query.difficulty?.toString().trim().toLowerCase() || "";

    // ✅ NEW: Parse industry, category, and sub_category filters
    const industry = req.query.industry?.toString().trim() || "";
    const category = req.query.category?.toString().trim() || "";
    const sub_category = req.query.sub_category?.toString().trim() || "";

    const result = await QuestionModel.getAll({
      page,
      limit,
      search,
      exam_id,
      correct_answer,
      from,
      to,
      difficulty,
      industry, // ✅ Pass to model
      category, // ✅ Pass to model
      sub_category, // ✅ Pass to model
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      filters: result.filters,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating immutable fields directly
    delete updates.id;
    delete updates.created_at;
    delete updates.question_hash;

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No update data provided" });
    }

    const affected = await QuestionModel.update(id, updates);
    if (affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    res.json({ success: true, message: "Question updated successfully" });
  } catch (err) {
    next(err);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  try {
    const affected = await QuestionModel.delete(req.params.id);
    if (affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    res.json({ success: true, message: "Question deleted successfully" });
  } catch (err) {
    next(err);
  }
};
