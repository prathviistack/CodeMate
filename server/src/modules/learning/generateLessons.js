import Lesson from "../../models/Lesson.js";
import Quiz from "../../models/Quiz.js";
import RepoFile from "../../models/RepoFile.js";

/**
 * Generate lessons from codebase analysis
 * Triggered after analysis phase completes
 */
export async function generateLessonsAndQuizzes(projectId, project) {
  try {
    // Clear existing auto-generated lessons and quizzes
    await Lesson.deleteMany({ projectId, isAuto: true });
    await Quiz.deleteMany({ projectId, isAuto: true });

    const files = await RepoFile.find({ projectId }).lean();

    if (files.length === 0) {
      return;
    }

    // Group files by directory for lesson generation
    const filesByDir = groupFilesByDirectory(files);
    const lessons = [];
    const quizzes = [];

    // Generate lessons for main directories
    let order = 0;
    for (const [dirPath, dirFiles] of Object.entries(filesByDir)) {
      // Skip node_modules, dist, build, etc.
      if (isSkippableDirectory(dirPath)) continue;

      const lesson = generateLessonForDirectory(projectId, dirPath, dirFiles, order);
      if (lesson) {
        lessons.push(lesson);
        order++;
      }
    }

    // Generate foundational lessons based on detected technologies
    const foundationLessons = generateFoundationLessons(projectId, project, order);
    lessons.push(...foundationLessons);
    order += foundationLessons.length;

    // Insert lessons
    const savedLessons = lessons.length > 0 ? await Lesson.insertMany(lessons) : [];

    // Generate quizzes based on lessons
    for (let i = 0; i < savedLessons.length; i++) {
      const quiz = generateQuizForLesson(savedLessons[i], i);
      if (quiz) {
        quizzes.push(quiz);
      }
    }

    // Insert quizzes
    if (quizzes.length > 0) {
      await Quiz.insertMany(quizzes);
    }

    return { lessonsCreated: savedLessons.length, quizzesCreated: quizzes.length };
  } catch (error) {
    console.error("Error generating lessons:", error);
    throw error;
  }
}

function groupFilesByDirectory(files) {
  const groups = {};

  files.forEach(file => {
    const pathParts = file.path.split("/");
    const topDir = pathParts[0] || "root";

    if (!groups[topDir]) {
      groups[topDir] = [];
    }
    groups[topDir].push(file);
  });

  return groups;
}

function isSkippableDirectory(dirPath) {
  const skipDirs = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".venv",
    "__pycache__",
    "vendor",
    "target",
  ];
  return skipDirs.some(skip => dirPath.includes(skip));
}

function generateLessonForDirectory(projectId, dirPath, dirFiles, order) {
  const sourceFiles = dirFiles.filter(f => !f.path.includes("test") && !f.path.includes("spec"));

  if (sourceFiles.length === 0) return null;

  const languages = [...new Set(sourceFiles.map(f => getLanguage(f.path)))];
  const fileCount = sourceFiles.length;

  return {
    projectId,
    title: formatDirectoryTitle(dirPath),
    description: `Explore the structure and purpose of the ${dirPath} directory with ${fileCount} source files`,
    content: `# ${formatDirectoryTitle(dirPath)}\n\nThis lesson covers the ${dirPath} directory.\n\n## What's here\n\n- **Files:** ${fileCount} source files\n- **Languages:** ${languages.join(", ")}\n\n## Key Files\n\n${sourceFiles
      .slice(0, 5)
      .map(f => `- \`${f.path}\` (${formatFileSize(f.size)})`)
      .join("\n")}\n\n## Next Steps\n\nExamine these files to understand how they work together.`,
    keyPoints: [`Understand the ${dirPath} directory structure`, `Learn how components interact`, "Identify key patterns and abstractions"],
    codeExamples: sourceFiles.slice(0, 2).map((f, idx) => ({
      title: `Example from ${f.path}`,
      code: f.content.split("\n").slice(0, 20).join("\n"),
      language: getLanguage(f.path),
      explanation: `This excerpt shows the start of ${f.path}. Examine the full file for context.`,
    })),
    relatedFiles: sourceFiles.slice(0, 5).map(f => ({
      path: f.path,
      relevance: "Part of this directory",
    })),
    difficulty: dirPath === "src" ? "beginner" : "intermediate",
    estimatedMinutes: Math.min(fileCount * 2, 30),
    order,
    isAuto: true,
  };
}

function generateFoundationLessons(projectId, project, startOrder) {
  const lessons = [];

  // Architecture overview lesson
  lessons.push({
    projectId,
    title: "Project Overview & Architecture",
    description: "Understand the overall structure and technology stack of this project",
    content: `# Project Architecture\n\n## Overview\n${
      project.summary || "This project uses a combination of frameworks and libraries."
    }\n\n## Technology Stack\n\n### Languages\n${project.languages.map(l => `- ${l}`).join("\n")}\n\n### Frameworks & Libraries\n${project.frameworks.map(f => `- ${f}`).join("\n")}\n\n## Learn More\n\nExplore the individual directories to see how these technologies are applied.`,
    keyPoints: [
      "Understand the project's purpose",
      `Familiar with ${project.languages.slice(0, 2).join(" and ")}`,
      "Know the main frameworks used",
    ],
    codeExamples: [],
    relatedFiles: [],
    difficulty: "beginner",
    estimatedMinutes: 10,
    order: startOrder,
    isAuto: true,
  });

  // Best practices lesson
  lessons.push({
    projectId,
    title: "Code Patterns & Best Practices",
    description: "Learn the common patterns and conventions used throughout this codebase",
    content: `# Code Patterns & Best Practices\n\n## Common Patterns\n\n1. **Module Organization** - Files are organized by functionality\n2. **Error Handling** - Consistent approach to error management\n3. **Testing** - Test files follow naming conventions\n4. **Configuration** - Environment-based configuration\n\n## Tips\n\n- Look for \`index.js\` files as entry points\n- Check \`package.json\` or equivalent for dependencies\n- Review \`.env.example\` for configuration options\n- Follow existing naming conventions`,
    keyPoints: ["Recognize common patterns", "Follow project conventions", "Understand error handling approach"],
    codeExamples: [],
    relatedFiles: [],
    difficulty: "intermediate",
    estimatedMinutes: 15,
    order: startOrder + 1,
    isAuto: true,
  });

  return lessons;
}

function generateQuizForLesson(lesson, order) {
  // Generate simple quiz questions based on lesson content
  const questions = [
    {
      text: `What is the main topic of this lesson?`,
      options: [lesson.title, "Random topic", "Another topic", "Unknown"],
      correctOptionIndex: 0,
      explanation: `This lesson covers ${lesson.title}.`,
    },
    {
      text: `Approximately how long should this lesson take?`,
      options: [
        `${lesson.estimatedMinutes} minutes`,
        `${lesson.estimatedMinutes * 2} minutes`,
        `5 minutes`,
        `1 hour`,
      ],
      correctOptionIndex: 0,
      explanation: `According to the lesson, it should take approximately ${lesson.estimatedMinutes} minutes.`,
    },
    {
      text: `What is the difficulty level of this lesson?`,
      options: [lesson.difficulty, "advanced", "beginner", "expert"],
      correctOptionIndex: 0,
      explanation: `This lesson is marked as ${lesson.difficulty} level.`,
    },
  ];

  if (lesson.keyPoints && lesson.keyPoints.length > 0) {
    questions.push({
      text: `Which is a key point from this lesson?`,
      options: lesson.keyPoints.slice(0, 4),
      correctOptionIndex: 0,
      explanation: `One of the main takeaways is: ${lesson.keyPoints[0]}`,
    });
  }

  return {
    projectId: lesson.projectId,
    title: `Quiz: ${lesson.title}`,
    description: `Test your understanding of ${lesson.title}`,
    questions,
    difficulty: lesson.difficulty,
    estimatedMinutes: Math.ceil(questions.length * 2.5),
    relatedLessons: [lesson._id],
    relatedFiles: lesson.relatedFiles,
    order,
    isAuto: true,
  };
}

function getLanguage(filePath) {
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) return "javascript";
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".py")) return "python";
  if (filePath.endsWith(".java")) return "java";
  if (filePath.endsWith(".go")) return "go";
  if (filePath.endsWith(".rs")) return "rust";
  if (filePath.endsWith(".rb")) return "ruby";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".html")) return "html";
  return "text";
}

function formatDirectoryTitle(dirPath) {
  return dirPath
    .split("/")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" > ");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(1) + "MB";
}
