import { Router } from "express";
import { chat, listConversations, getConversation, deleteConversation } from "./tutor.controller.js";
import { loadOwnedProject } from "../../middleware/loadProject.js";

const router = Router();

// Chat with the tutor for a project
router.post("/:projectId/tutor/chat", loadOwnedProject, chat);

// List conversations for a project
router.get("/:projectId/tutor/conversations", loadOwnedProject, listConversations);

// Get a specific conversation
router.get("/:projectId/tutor/conversations/:conversationId", loadOwnedProject, getConversation);

// Delete a conversation
router.delete("/:projectId/tutor/conversations/:conversationId", loadOwnedProject, deleteConversation);

export default router;
