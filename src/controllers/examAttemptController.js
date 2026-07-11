const examModel = require("../models/examModel");
const examAttemptModel = require("../models/examAttemptModel");
const userAnswerModel = require("../models/userAnswerModel");
const QuestionModel = require("../models/questionModel");

// Pass percentage required to pass the exam (configurable per exam in a future iteration)
// ✅ UPDATED: Pass percentage required to pass the exam changed to 90%
const DEFAULT_PASS_PERCENTAGE = 90;

/**
 * POST /api/exams/:id/start
 *
 * Creates a new exam_attempt record and returns the attemptId.
 * The frontend must store this and pass it in the submit payload.
 */
exports.startExam = async (req, res) => {
  try {
    const examId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Verify exam exists
    const exam = await examModel.getExamById(examId);
    if (!exam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    if (exam.status !== "published") {
      return res
        .status(403)
        .json({ success: false, message: "Exam is not available" });
    }

    // 2. Create attempt
    const attemptId = await examAttemptModel.createAttempt({
      user_id: userId,
      exam_id: examId,
      total_marks: exam.total_marks,
    });

    return res.status(201).json({
      success: true,
      attemptId,
    });
  } catch (error) {
    console.error("startExam error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start exam",
      error: error.message,
    });
  }
};

/**
 * GET /api/exams/:id/questions
 *
 * Returns shuffled questions for an exam WITHOUT correct_answer or explanation.
 * Security: answers are evaluated server-side only.
 */

exports.getExamQuestions = async (req, res) => {
  try {
    const examId = parseInt(req.params.id);

    const exam = await examModel.getExamById(examId);
    if (!exam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }
    if (exam.status !== "published") {
      return res
        .status(403)
        .json({ success: false, message: "Exam is not available" });
    }

    // ✅ PASS THE LIMIT: Fetch only 'no_of_questions' randomly selected questions
    const questions = await QuestionModel.getQuestionsForExam(
      examId,
      exam.no_of_questions,
    );

    return res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    console.error("getExamQuestions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
      error: error.message,
    });
  }
};

/**
 * POST /api/exams/submit
 *
 * Body:
 * {
 *   attemptId: 45,
 *   answers: { "101": "A", "102": "C", "103": "D" }
 * }
 *
 * Evaluates answers server-side, persists results, and returns the score summary.
 */

exports.submitExam = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { attemptId, answers } = req.body;
    if (!attemptId || typeof answers !== "object" || answers === null) {
      return res.status(400).json({
        success: false,
        message: "attemptId and answers are required",
      });
    }

    // 1. Validate attempt exists
    const attempt = await examAttemptModel.getAttemptById(attemptId);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    // 2. Validate ownership
    if (attempt.user_id !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // 3. Prevent double submission
    if (attempt.status === "submitted") {
      return res.status(409).json({
        success: false,
        message: "Exam already submitted",
      });
    }

    // 4. Fetch exam
    const exam = await examModel.getExamById(attempt.exam_id);
    if (!exam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    // ✅ FIX: The true total questions is defined by the exam configuration,
    // NOT by how many questions the user happened to answer.
    const totalQuestions = exam.no_of_questions;

    // 5. Fetch correct answers (server-side only)
    const questionIds = Object.keys(answers)
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id));

    const correctAnswers = await QuestionModel.getCorrectAnswersForExam(
      attempt.exam_id,
      questionIds,
    );

    // 6. Evaluate answers
    let correct_count = 0;
    let wrong_count = 0;
    const userAnswerRows = [];

    for (const [questionIdStr, correctAnswer] of Object.entries(
      correctAnswers,
    )) {
      const questionId = parseInt(questionIdStr);
      const selectedAnswer = answers[questionIdStr] || answers[questionId];

      const isCorrect =
        selectedAnswer.toUpperCase() === correctAnswer.toUpperCase();
      if (isCorrect) {
        correct_count++;
      } else {
        wrong_count++;
      }

      userAnswerRows.push({
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: selectedAnswer.toUpperCase(),
        is_correct: isCorrect,
      });
    }

    // ✅ FIX: Calculate unanswered questions correctly based on the exam's total length
    const validAnsweredCount = Object.keys(correctAnswers).length;
    const unanswered_count = Math.max(0, totalQuestions - validAnsweredCount);

    // 7. Calculate score and percentage
    const pointsPerQuestion = exam.points_per_question || 1;
    const score = correct_count * pointsPerQuestion;
    const percentage =
      totalQuestions > 0
        ? parseFloat(((correct_count / totalQuestions) * 100).toFixed(2))
        : 0;
    const passed = percentage >= DEFAULT_PASS_PERCENTAGE;

    // 8. Save user_answers (bulk insert)
    if (userAnswerRows.length > 0) {
      await userAnswerModel.insertAnswers(userAnswerRows);
    }

    // 9. Update exam_attempts with results
    await examAttemptModel.updateAttemptResult(attemptId, {
      score,
      percentage,
      correct_count,
      wrong_count,
      unanswered_count,
      passed,
    });

    // 10. Return result summary
    return res.json({
      success: true,
      score,
      percentage,
      correct: correct_count,
      wrong: wrong_count,
      unanswered: unanswered_count,
      passed,
      totalQuestions, // ✅ Now correctly reflects the actual exam length
      totalMarks: exam.total_marks,
    });
  } catch (error) {
    console.error("submitExam error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit exam",
      error: error.message,
    });
  }
};

/**
 * GET /api/exams/result/:attemptId
 *
 * Returns the result for a completed exam attempt.
 * Only the owner of the attempt may access it.
 */

exports.getResult = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const attemptId = parseInt(req.params.attemptId);
    const attempt = await examAttemptModel.getAttemptById(attemptId);

    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: "Result not found" });

    if (attempt.user_id !== userId)
      return res.status(403).json({ success: false, message: "Forbidden" });

    if (attempt.status !== "submitted")
      return res
        .status(400)
        .json({ success: false, message: "Exam has not been submitted yet" });

    // ✅ Fetch exam to get the true total questions for the response payload
    const exam = await examModel.getExamById(attempt.exam_id);
    const totalQuestions = exam
      ? exam.no_of_questions
      : attempt.correct_count + attempt.wrong_count + attempt.unanswered_count;

    // ── Fetch answer review (user answer + correct answer + question text) ──
    const answerReview = await userAnswerModel.getAnswersByAttempt(attemptId);

    return res.json({
      success: true,
      data: {
        attemptId: attempt.id,
        examId: attempt.exam_id,
        score: attempt.score,
        percentage: attempt.percentage,
        correct: attempt.correct_count,
        wrong: attempt.wrong_count,
        unanswered: attempt.unanswered_count,
        passed: attempt.passed === 1 || attempt.passed === true,
        totalMarks: attempt.total_marks,
        totalQuestions, // ✅ Explicitly send total questions to the frontend
        startTime: attempt.start_time,
        endTime: attempt.end_time,
        answerReview,
      },
    });
  } catch (error) {
    console.error("getResult error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch result",
      error: error.message,
    });
  }
};

/**
 * GET /api/exams/my-attempts
 * Returns a list of exam attempts for the logged-in user.
 */
exports.getMyAttempts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Fetch attempts
    const attempts = await examAttemptModel.getUserAttempts(
      userId,
      limit,
      offset,
    );

    // Fetch total count for pagination
    const total = await examAttemptModel.countUserAttempts(userId);

    return res.json({
      success: true,
      data: attempts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getMyAttempts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attempts",
      error: error.message,
    });
  }
};
