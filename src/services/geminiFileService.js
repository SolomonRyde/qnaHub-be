const { GoogleGenAI } = require("@google/genai");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Upload PDF buffer to Gemini Files API.
 * Returns { uri, mimeType, name } for use in generateContent.
 */
async function uploadPdfToGemini(pdfBuffer, originalFilename) {
  try {
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });

    let file = await ai.files.upload({
      file: blob,
      config: {
        mimeType: "application/pdf",
        displayName: originalFilename,
      },
    });

    // Wait until the file is ready (usually instant for small PDFs)
    let attempts = 0;
    while (file.state === "PROCESSING" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 1000));
      file = await ai.files.get({ name: file.name });
      attempts++;
    }
    if (file.state === "FAILED") throw new Error("PDF_CORRUPTED");

    return {
      uri: file.uri,
      mimeType: file.mimeType,
      name: file.name, // used for deletion later
    };
  } catch (error) {
    if (error.message === "PDF_CORRUPTED") throw error;

    if (
      error.message?.includes("encrypted") ||
      error.message?.includes("password")
    ) {
      throw new Error("PDF_ENCRYPTED");
    } else if (
      error.message?.includes("corrupt") ||
      error.message?.includes("invalid")
    ) {
      throw new Error("PDF_CORRUPTED");
    }
    console.error("Gemini upload error:", error);
    throw error;
  }
}

/**
 * Delete uploaded file from Gemini
 */
async function deleteGeminiFile(geminiFileName) {
  if (!geminiFileName) return;
  try {
    await ai.fileManager.delete(geminiFileName);
  } catch (error) {
    console.warn("Failed to delete Gemini file:", error.message);
    // Non-critical - Gemini auto-deletes after 48 hours
  }
}

module.exports = {
  uploadPdfToGemini,
  deleteGeminiFile,
};
