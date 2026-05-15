const StagingModel = require("../models/stagingQuestionModel");
const duplicateService = require("../services/duplicateService");
const ImportModel = require("../models/questionImportModel");
const QuestionModel = require("../models/questionModel");
const db = require("../config/db");

exports.getStagingQuestions = async (req, res, next) => {
  try {
    const importId = req.query.import_id;
    if (!importId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing import_id query param" });
    }

    // Parse pagination and filter params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const search = req.query.search?.toString().trim() || "";
    const exam_id = req.query.exam_id?.toString().trim() || "";
    const stage_status =
      req.query.status?.toString().trim() ||
      req.query.stage_status?.toString().trim() ||
      "";

    const result = await StagingModel.getByImportId({
      import_id: parseInt(importId),
      page,
      limit,
      search,
      exam_id,
      stage_status,
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

exports.removeDuplicates = async (req, res, next) => {
  try {
    const importId = parseInt(req.body.import_id);
    if (!importId)
      return res
        .status(400)
        .json({ success: false, message: "Missing import_id" });

    const result = await duplicateService.detectAndMarkDuplicates(importId);
    await ImportModel.updateStage(importId, "DUPLICATES_CHECKED");

    res.json({
      success: true,
      message: "Duplicate check completed",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPushPreview = async (req, res, next) => {
  try {
    const importId = parseInt(req.query.import_id);
    if (!importId)
      return res
        .status(400)
        .json({ success: false, message: "Missing import_id query param" });

    const counts = await StagingModel.countByStatus(importId);
    res.json({ success: true, data: counts });
  } catch (err) {
    next(err);
  }
};

exports.pushDistinct = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const importId = parseInt(req.body.import_id);
    if (!importId)
      return res
        .status(400)
        .json({ success: false, message: "Missing import_id" });

    await connection.beginTransaction();

    const validQuestions = await StagingModel.getValidByImportId(importId);
    if (validQuestions.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "No valid distinct questions to push",
      });
    }

    const pushedCount = await QuestionModel.insertBatchIgnore(validQuestions);
    await StagingModel.markPushed(validQuestions.map((q) => q.stage_id));

    const stats = await StagingModel.countByStatus(importId);
    await ImportModel.updateStage(importId, "COMPLETED", stats);

    await connection.commit();
    res.json({
      success: true,
      message: `Successfully pushed ${pushedCount} questions to production`,
      data: { pushed: pushedCount },
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};
