const StagingModel = require("../models/stagingQuestionModel");
const duplicateService = require("../services/duplicateService");
const ImportModel = require("../models/questionImportModel");
const QuestionModel = require("../models/questionModel");
const db = require("../config/db");

/**
 * Get Staging Questions with proper pagination and all JOINs
 */
exports.getStagingQuestions = async (req, res, next) => {
  try {
    const { import_id, search, exam_id, stage_status, page, limit } = req.query;

    // Parse pagination params with defaults
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit) || 10)); // Max 1000 per page

    const result = await StagingModel.getByImportId({
      import_id: import_id ? parseInt(import_id) : undefined,
      page: pageNum,
      limit: limitNum,
      search: search || "",
      exam_id: exam_id || "",
      stage_status: stage_status || "",
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalRows: result.pagination.total,
        totalPages: result.pagination.totalPages,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
      },
      filters: result.filters,
    });
  } catch (error) {
    console.error("getStagingQuestions error:", error);
    next(error);
  }
};

// exports.removeDuplicates = async (req, res, next) => {
//   try {
//     const importId = parseInt(req.body.import_id);
//     if (!importId)
//       return res
//         .status(400)
//         .json({ success: false, message: "Missing import_id" });

//     const result = await duplicateService.detectAndMarkDuplicates(importId);
//     await ImportModel.updateStage(importId, "DUPLICATES_CHECKED");

//     res.json({
//       success: true,
//       message: "Duplicate check completed",
//       data: result,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

/**
 * ✅ UPDATED: removeDuplicates now works with or without an import_id
 */
exports.removeDuplicates = async (req, res, next) => {
  try {
    // import_id is now optional. If missing, it defaults to null (global check)
    const importId = req.body.import_id ? parseInt(req.body.import_id) : null;

    // Run the duplicate detection service
    const result = await duplicateService.detectAndMarkDuplicates(importId);

    // If an import_id was provided, update the import stage status
    if (importId) {
      await ImportModel.updateStage(importId, "DUPLICATES_CHECKED");
      return res.json({
        success: true,
        message: `Duplicate check completed for import ${importId}`,
        data: result,
      });
    }

    // Global check response (no import_id provided)
    res.json({
      success: true,
      message: "Global duplicate check completed for all staging questions",
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

// ... existing imports and code ...

/**
 * GET /staging-questions/final-push-preview
 */
exports.getFinalPushPreview = async (req, res, next) => {
  try {
    const data = await StagingModel.getFinalPushPreview();
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /staging-questions/push-final-distinct
 */
exports.pushFinalDistinct = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Step 1: Fetch final distinct questions
    const validQuestions =
      await StagingModel.getFinalDistinctQuestions(connection);

    let pushedCount = 0;
    if (validQuestions.length > 0) {
      // Step 2: Bulk insert into questions table
      // Note: We pass 'connection' as the second argument. If your existing
      // QuestionModel.insertBatchIgnore doesn't accept a connection parameter,
      // it will safely ignore it, but the INSERT will happen outside the transaction.
      // For strict transactional integrity, ensure insertBatchIgnore uses the passed connection.
      pushedCount = await QuestionModel.insertBatchIgnore(
        validQuestions,
        connection,
      );

      // Step 3: Mark inserted rows as pushed
      const stageIds = validQuestions.map((q) => q.stage_id);
      await StagingModel.markPushed(stageIds, connection);
    }

    // Step 4: Mark remaining duplicate staging rows
    await StagingModel.markStagingDuplicates(connection);

    // Step 5: Mark rows already existing in production
    await StagingModel.markProductionDuplicates(connection);

    await connection.commit();

    // Fetch final stats for the response
    const [finalStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_staging,
        SUM(CASE WHEN stage_status = 'duplicate_in_prod' THEN 1 ELSE 0 END) as already_in_main_db,
        SUM(CASE WHEN stage_status = 'duplicate_in_staging' THEN 1 ELSE 0 END) as duplicates_inside_staging,
        SUM(CASE WHEN stage_status = 'pushed' THEN 1 ELSE 0 END) as pushed
      FROM staging_questions
    `);

    res.json({
      success: true,
      message: "Final distinct questions pushed successfully",
      data: {
        total_staging: finalStats[0].total_staging,
        already_in_main_db: finalStats[0].already_in_main_db || 0,
        duplicates_inside_staging: finalStats[0].duplicates_inside_staging || 0,
        // pushed: finalStats[0].pushed || 0,
        pushed: pushedCount, // ← use actual insert count
      },
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

/**
 * POST /staging-questions/validate-all
 * Validates all staging questions and returns a breakdown of their statuses.
 */
exports.validateAll = async (req, res, next) => {
  try {
    const { scope } = req.body;

    // Optional: Validate the scope parameter if you want to enforce it
    if (scope && scope !== "all") {
      return res.status(400).json({
        success: false,
        message: "Invalid scope. Currently only 'all' is supported.",
      });
    }

    const data = await StagingModel.validateAllStaging();

    res.json({
      success: true,
      message: "All staging questions validated successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
};
