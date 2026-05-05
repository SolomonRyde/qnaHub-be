const { GoogleGenAI } = require("@google/genai");
const Joi = require('joi');
const { catchAsync, throwError } = require('../utils/errorHandler'); // adjust path
const { AppError } = require('../middleware/errorHandler');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const schema = Joi.object({
  category: Joi.string().valid('aptitude', 'coding', 'sciences', 'logic', 'verbal').required()
});

exports.generateResponse = catchAsync(async (req, res, next) => {

  // ✅ Validation
  const { error, value } = schema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
    // OR: throwError(error.details[0].message, 400);
  }

  const { category } = value;

  // ✅ Call Gemini
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [{
        text: `Generate 10 ${category} questions. Return a JSON array of objects. 
        Structure: [{"question": "string", "options": ["str", "str", "str", "str"], "answer": "str", "explanation": "str"}]`
      }]
    }],
    config: {
      responseMimeType: "application/json",
    }
  });

  // ✅ Parse response
  let questions;
  try {
    questions = JSON.parse(result.text);
  } catch (parseErr) {
    throw new AppError('Invalid JSON response from AI', 500);
  }

  // ✅ Optional safety check
  if (!Array.isArray(questions)) {
    throw new AppError('Unexpected response format from AI', 500);
  }

  // ✅ Success response
  res.json({
    success: true,
    count: questions.length,
    questions
  });

});