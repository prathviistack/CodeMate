import RepoFile from "../../models/RepoFile.js";
import Conversation from "../../models/Conversation.js";
import Lesson from "../../models/Lesson.js";
import Quiz from "../../models/Quiz.js";
import { registerProjectData } from "./project.cascade.js";

// Everything stored per project must be registered so deleting a project removes it
// and the delete dialog can say what will be lost. Later phases add their models here.
registerProjectData({ label: "stored source files", model: RepoFile });
registerProjectData({ label: "tutor conversations", model: Conversation });
registerProjectData({ label: "lessons", model: Lesson });
registerProjectData({ label: "quizzes", model: Quiz });
