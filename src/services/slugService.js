const slugService = {
  generateSlug: async (title, examModel, examId = null) => {
    // Create base slug from title
    let slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if slug exists
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existingExam = await examModel.findExamBySlug(uniqueSlug);

      if (!existingExam || (examId && existingExam.id === examId)) {
        break;
      }

      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  },
};

module.exports = slugService;
