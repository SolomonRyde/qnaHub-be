const { GoogleGenAI } = require("@google/genai");
const Joi = require("joi");
const fs = require("fs/promises");
const path = require("path");
const { catchAsync } = require("../utils/errorHandler");
const { AppError } = require("../middleware/errorHandler");
const examModel = require("../models/examModel");
const llmModel = require("../models/llmModel");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const UPLOAD_DIR = "/home/u911106075/uploads/generated-questions";

// ✅ Updated Schema - Changed "medium" to "intermediate"
const schema = Joi.object({
  exam_id: Joi.number()
    .integer()
    .required()
    .messages({ "any.required": "Exam ID is required" }),
  difficulty: Joi.string()
    .valid("easy", "intermediate", "hard")
    .default("easy"),
  count: Joi.number().integer().min(1).max(100).default(10),
  prompt: Joi.string().max(1000).allow("").default(""),
  model: Joi.string()
    .valid("gemini-2.5-flash", "gemini-2.5-pro")
    .default("gemini-2.5-flash")
    .messages({
      "any.only": "Model must be gemini-2.5-flash or gemini-2.5-pro",
    }),
});

function recoverPartialJSON(rawText) {
  if (!rawText) return null;
  const lastCompleteObj = rawText.lastIndexOf("},");
  if (lastCompleteObj === -1) {
    const lastBrace = rawText.lastIndexOf("}");
    if (lastBrace === -1) return null;
    const recovered = rawText.substring(0, lastBrace + 1) + "]";
    try {
      return JSON.parse(recovered);
    } catch {
      return null;
    }
  }
  const recovered = rawText.substring(0, lastCompleteObj + 1) + "]";
  try {
    return JSON.parse(recovered);
  } catch {
    return null;
  }
}

exports.generateResponse = catchAsync(async (req, res, next) => {
  const today = new Date().toISOString().split("T")[0];

  // Ensure today's stats row exists and increment requests
  let dailyStats = await llmModel.getDailyStats(today);
  if (!dailyStats) await llmModel.createDailyStats(today);
  await llmModel.updateDailyStats(today, { total_requests: 1 });

  const generatedByUserId = req.user?.id || null;
  const generatedByName =
    req.user?.full_name || req.user?.name || req.user?.username || "Unknown";

  try {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      await llmModel.updateDailyStats(today, { failed_generations: 1 });
      await llmModel.createGenerationHistory({
        status: "FAILED",
        generated_by_user_id: generatedByUserId,
        generated_by_name: generatedByName,
      });
      throw new AppError(error.details.map((d) => d.message).join(", "), 400);
    }

    const { exam_id, difficulty, count, prompt, model } = value;
    const exam = await examModel.findExamById(exam_id);
    if (!exam) {
      await llmModel.updateDailyStats(today, { failed_generations: 1 });
      throw new AppError(`Exam with ID ${exam_id} not found.`, 404);
    }

    const effectiveCount = count;

    const customInstructions = prompt
      ? `TOPIC RESTRICTION:
          Generate questions ONLY from the topic: "${prompt}".
          All questions must belong to this topic.
          Do not generate questions from unrelated topics.
          Do not generate duplicate or near-duplicate questions.
          Cover different concepts/sub-topics within "${prompt}" across the ${effectiveCount} questions.
          Maintain "${difficulty}" difficulty level for every question — do not let
          question complexity drift above or below this level.

        QUESTION MIX:
          Include a mix of conceptual/theory questions, "predict the output" or
          "find the error" code-based questions (where applicable to this topic),
          and scenario-based questions relevant to technical interviews.`
      : `Generate general questions suitable for "${difficulty}" difficulty level.`;

    const systemPrompt = `Generate ${effectiveCount} multiple-choice questions.

Difficulty:
${difficulty}

Custom Instructions:
${customInstructions}

Requirements:
- The output array MUST contain EXACTLY ${effectiveCount} question objects — not ${effectiveCount - 1}, not ${effectiveCount + 1}. Count the objects before finishing your response.
- Each question must have exactly 4 distinct options (option_a through option_d)
- Only one option is correct
- correct_answer must be exactly one of: "A", "B", "C", "D"
- Each explanation must be 1-2 concise sentences (max 35 words) explaining WHY the correct answer is correct
- Each question must include a "sub_topic" field — a short 2-4 word label for the specific concept being tested within "${prompt || difficulty}"
- All ${effectiveCount} questions must be unique — no duplicates or near-duplicate rephrasings, and no two questions should share the same sub_topic + same underlying concept
- All questions must match the "${difficulty}" difficulty level
- Keep question, option, and explanation text concise to avoid running out of output space

IMPORTANT — OUTPUT FORMAT:
- Return ONLY a raw JSON array — nothing else
- Do not wrap in markdown code fences (no \`\`\`)
- Do not include any text, notes, or explanations before or after the array
- The response must start with '[' and end with ']'
- The response must be complete, valid, parseable JSON — never truncate mid-object
- If you are at risk of exceeding the output limit, reduce explanation length, not the number of questions

Output Format (exactly ${effectiveCount} objects in this shape):
[
  {
    "question": "Question text",
    "option_a": "Option A",
    "option_b": "Option B",
    "option_c": "Option C",
    "option_d": "Option D",
    "correct_answer": "A",
    "explanation": "Short 1-2 sentence explanation (max 35 words)"
  }
]

Before responding, verify: does the array have exactly ${effectiveCount} elements? If not, add or remove items until it does.`;

    console.log(
      `Generating ${effectiveCount} questions (requested: ${count}, difficulty: ${difficulty})`,
    );

    // ✅ Dynamic Model Selection
    const result = await ai.models.generateContent({
      model: model,
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 32000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    let questions,
      wasPartiallyRecovered = false;
    try {
      const rawText = result.text
        ?.trim()
        .replace(/^```json\s*|\s*```$/g, "")
        .trim();
      if (!rawText) throw new Error("Empty response");
      try {
        questions = JSON.parse(rawText);
      } catch (e) {
        const recovered = recoverPartialJSON(rawText);
        if (recovered && Array.isArray(recovered)) {
          questions = recovered;
          wasPartiallyRecovered = true;
        } else throw e;
      }
    } catch (parseErr) {
      await llmModel.updateDailyStats(today, { failed_generations: 1 });
      throw new AppError("Invalid JSON response from AI.", 500);
    }

    const normalizedQuestions = questions
      .map((q) => ({
        question: q.question?.trim(),
        option_a: q.option_a?.trim(),
        option_b: q.option_b?.trim(),
        option_c: q.option_c?.trim(),
        option_d: q.option_d?.trim(),
        correct_answer: q.correct_answer?.trim().toUpperCase(),
        explanation: q.explanation?.trim(),
      }))
      .filter(
        (q) =>
          q.question &&
          q.option_a &&
          q.option_b &&
          q.option_c &&
          q.option_d &&
          ["A", "B", "C", "D"].includes(q.correct_answer),
      );

    if (normalizedQuestions.length === 0) {
      await llmModel.updateDailyStats(today, { failed_generations: 1 });
      throw new AppError("AI returned no valid questions.", 500);
    }

    // The raw number of valid questions the AI actually produced,
    // before we trim it down to what was requested.
    const aiGeneratedCount = normalizedQuestions.length;

    // ✅ Enforce the requested count — never return/store more than asked for
    let finalQuestions = normalizedQuestions;
    if (finalQuestions.length > effectiveCount) {
      console.log(
        `⚠️ AI returned ${finalQuestions.length} questions, trimming down to requested ${effectiveCount}`,
      );
      finalQuestions = finalQuestions.slice(0, effectiveCount);
    } else if (finalQuestions.length < effectiveCount) {
      console.log(
        `⚠️ AI returned only ${finalQuestions.length} of ${effectiveCount} requested questions`,
      );
    }

    // --- SUCCESS TRACKING ---
    const usageMetadata = result.usageMetadata || {};
    const promptTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const thoughtsTokens = usageMetadata.thoughtsTokenCount || 0;
    const totalTokens =
      usageMetadata.totalTokenCount ||
      promptTokens + outputTokens + thoughtsTokens;

    await llmModel.updateDailyStats(today, {
      successful_generations: 1,
      prompt_tokens: promptTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
    });
    await llmModel.updateOverallStats(finalQuestions.length);

    // --- FILE GENERATION, STORAGE & DB METADATA ---
    let fileId;
    try {
      console.log("📁 Attempting to create directory:", UPLOAD_DIR);
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      console.log("✅ Upload directory ready:", UPLOAD_DIR);

      const maxSerial = await llmModel.getMaxSerial();
      console.log("📊 Max serial from DB:", maxSerial);

      const serial = String(maxSerial + 1).padStart(5, "0");

      // ✅ FIX: Added .trim() to prevent double underscores from trailing spaces
      const examTitleClean = exam.exam_title
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_");

      const fileName = `${examTitleClean}_${difficulty.toUpperCase()}_${effectiveCount}_${serial}.json`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      console.log("📝 Full server path:", filePath);
      console.log(
        "📋 Database path:",
        `/uploads/generated-questions/${fileName}`,
      );
      console.log("📄 File name:", fileName);

      const fileContent = JSON.stringify(finalQuestions, null, 2);
      console.log("✍️  Writing file, size:", fileContent.length, "bytes");

      await fs.writeFile(filePath, fileContent, "utf8");
      console.log("✅ File written successfully");

      // Verify file was created
      const fileStats = await fs.stat(filePath);
      console.log("✅ File verified, size:", fileStats.size, "bytes");

      // ✅ DB Operations (Moved inside try block to access fileName and fileId)
      console.log("💾 Creating database record for file...");
      fileId = await llmModel.createGeneratedFile({
        exam_id,
        exam_title: exam.exam_title,
        difficulty,
        question_count: finalQuestions.length,
        llm_model: model,
        generated_by_user_id: generatedByUserId,
        generated_by_name: generatedByName,
        file_name: fileName,
        file_path: `/uploads/generated-questions/${fileName}`,
      });
      console.log("✅ Database record created with ID:", fileId);

      await llmModel.createGenerationHistory({
        exam_id,
        difficulty,
        question_count: finalQuestions.length,
        model_used: model,
        generated_by_user_id: generatedByUserId,
        generated_by_name: generatedByName,
        prompt_tokens: promptTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        file_id: fileId,
        status: "SUCCESS",
      });
      console.log("✅ Generation history created");
    } catch (fileError) {
      console.error("❌ File/DB saving error:", fileError);
      console.error("❌ Error code:", fileError.code);
      console.error("❌ Error message:", fileError.message);
      console.error("❌ Upload directory:", UPLOAD_DIR);

      // If we created a DB record but file failed, clean it up
      if (fileId) {
        try {
          await llmModel.deleteGeneratedFile(fileId);
          console.log("🗑️ Cleaned up database record");
        } catch (cleanupErr) {
          console.error("❌ Cleanup failed:", cleanupErr);
        }
      }

      throw new AppError(
        `Failed to save generated questions: ${fileError.message}`,
        500,
      );
    }

    // Fetch updated stats for response
    const updatedDailyStats = await llmModel.getDailyStats(today);
    const overallStats = await llmModel.getOverallStats();

    // ✅ Include exam metadata in response for CSV export
    res.json({
      success: true,
      exam_id,
      exam_metadata: {
        industry: exam.industry_name || "",
        category: exam.category_name || "",
        subcategory: exam.sub_category_name || "",
      },
      requested: count,
      ai_generated_count: aiGeneratedCount,
      count: finalQuestions.length,
      trimmed: aiGeneratedCount > effectiveCount,
      trimmed_count:
        aiGeneratedCount > effectiveCount
          ? aiGeneratedCount - effectiveCount
          : 0,
      partially_recovered: wasPartiallyRecovered,
      questions: finalQuestions,
      usage: {
        prompt_tokens: promptTokens,
        output_tokens: outputTokens,
        thoughts_tokens: thoughtsTokens,
        total_tokens: totalTokens,
      },
      stats: {
        total_requests: updatedDailyStats.total_requests,
        successful_generations: updatedDailyStats.successful_generations,
        failed_generations: updatedDailyStats.failed_generations,
        total_questions_generated: overallStats.total_questions_generated,
        total_prompt_tokens: updatedDailyStats.prompt_tokens,
        total_output_tokens: updatedDailyStats.output_tokens,
        total_tokens_used: updatedDailyStats.total_tokens,
      },
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      await llmModel.updateDailyStats(today, { failed_generations: 1 });
    }
    throw err;
  }
});

exports.getAiStats = catchAsync(async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  let dailyStats = await llmModel.getDailyStats(today);
  if (!dailyStats) {
    await llmModel.createDailyStats(today);
    dailyStats = await llmModel.getDailyStats(today);
  }
  const overallStats = await llmModel.getOverallStats();

  res.json({
    success: true,
    stats: {
      total_requests: dailyStats.total_requests,
      successful_generations: dailyStats.successful_generations,
      failed_generations: dailyStats.failed_generations,
      total_questions_generated: overallStats.total_questions_generated,
      total_prompt_tokens: dailyStats.prompt_tokens,
      total_output_tokens: dailyStats.output_tokens,
      total_tokens_used: dailyStats.total_tokens,
    },
  });
});

exports.getGeneratedFiles = catchAsync(async (req, res) => {
  const files = await llmModel.getGeneratedFiles();
  const mappedFiles = files.map((f) => ({
    ...f,
    file_url: `https://api.rydevalues.cloud${f.file_path}`,
  }));
  res.json({ success: true, data: mappedFiles });
});

exports.deleteGeneratedFile = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = await llmModel.getGeneratedFileById(id);
  if (!file) throw new AppError("File not found", 404);

  const fullPath = path.join("/home/u911106075", file.file_path);
  try {
    await fs.unlink(fullPath);
  } catch (e) {
    console.warn("Physical file missing, deleting DB record");
  }

  await llmModel.deleteGeneratedFile(id);
  res.json({ success: true, message: "File deleted" });
});
