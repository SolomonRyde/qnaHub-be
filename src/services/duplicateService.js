const StagingModel = require("../models/stagingQuestionModel");
const QuestionModel = require("../models/questionModel");

/**
 * ✅ UPDATED: Now accepts an optional importId.
 * If null, it checks duplicates across the entire staging table.
 */
exports.detectAndMarkDuplicates = async (importId = null) => {
  // 1. Fetch all valid (ready_to_push) staging rows
  const stagingRows = await StagingModel.getValidStagingRows(importId);

  if (!stagingRows || stagingRows.length === 0) {
    return { marked: 0, total: 0 };
  }

  // 2. Check against Production DB
  // Get unique exam_ids from the staging rows
  const examIds = [...new Set(stagingRows.map((r) => r.exam_id))];

  // Fetch existing hashes from production for these exams
  const prodHashes = await QuestionModel.getExistingHashes(examIds);

  const updates = [];

  for (const row of stagingRows) {
    const composite = `${row.exam_id}:${row.question_hash}`;

    if (prodHashes.has(composite)) {
      updates.push({
        stage_id: row.stage_id,
        status: "duplicate_in_prod",
        reason: `Already exists in production for exam ${row.exam_id}`,
      });
    }
  }

  // 3. Update the statuses in the staging table
  if (updates.length > 0) {
    await StagingModel.updateStatuses(updates);
  }

  return {
    marked: updates.length,
    total: stagingRows.length,
  };
};
