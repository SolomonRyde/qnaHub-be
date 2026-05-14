const StagingModel = require("../models/stagingQuestionModel");
const QuestionModel = require("../models/questionModel");

exports.detectAndMarkDuplicates = async (importId) => {
  const stagingRows = await StagingModel.getByImportId(importId, "VALID");
  if (stagingRows.length === 0) return { marked: 0 };

  // 1. Check against Production DB
  const examIds = [...new Set(stagingRows.map((r) => r.exam_id))];
  const prodHashes = await QuestionModel.getExistingHashes(examIds);

  const updates = [];
  for (const row of stagingRows) {
    const composite = `${row.exam_id}:${row.question_hash}`;
    if (prodHashes.has(composite)) {
      updates.push({
        id: row.id,
        status: "DUPLICATE_IN_PROD",
        reason: `Already exists in production for exam ${row.exam_id}`,
      });
    }
  }

  if (updates.length > 0) {
    await StagingModel.updateStatuses(updates);
  }

  return { marked: updates.length, total: stagingRows.length };
};
