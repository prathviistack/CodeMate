import Conversation from "../../models/Conversation.js";
import RepoFile from "../../models/RepoFile.js";
import { retrieveRelevantFiles, getCodebaseSummary } from "../../rag/retrieval.js";
import { AppError } from "../../utils/errors.js";
import { env } from "../../config/env.js";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Start or continue a conversation with the codebase tutor.
 */
export async function chat(req, res, next) {
  try {
    const { projectId } = req.params;
    const { message, conversationId } = req.body;

    if (!message?.trim()) {
      throw new AppError(400, "Message cannot be empty.", "empty_message");
    }

    // Load or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.projectId.toString() !== projectId) {
        throw new AppError(404, "Conversation not found.", "not_found");
      }
    } else {
      conversation = new Conversation({
        projectId,
        ownerId: req.user._id,
        messages: [],
      });
    }

    // Add user message
    conversation.messages.push({
      role: "user",
      content: message,
      citations: [],
    });

    // Retrieve relevant files
    const relevantFiles = await retrieveRelevantFiles(projectId, message, 5);
    const summary = await getCodebaseSummary(projectId);

    // Build context for Claude
    const fileContext = relevantFiles
      .map((f) => `File: ${f.path} (${f.language})\n${f.excerpt}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are an expert code tutor helping someone learn a codebase.
The codebase is primarily written in: ${summary.languages.join(", ")}.
Key files: ${summary.topSourceFiles.join(", ")}.

Here is relevant code from the repository:
\`\`\`
${fileContext}
\`\`\`

Answer questions about this codebase clearly and concisely. Reference specific files and line numbers when helpful.
If you're not sure about something, say so. Keep answers focused on the code shown above.`;

    // Get assistant response
    const response = await callGemini(
      systemPrompt,
      conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
    );

    // Add assistant response
    conversation.messages.push({
      role: "assistant",
      content: response,
      citations: relevantFiles.map((f) => ({
        path: f.path,
        excerpt: f.excerpt,
      })),
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.json({
      id: conversation.id,
      messages: conversation.messages,
      citations: relevantFiles,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List conversations for a project
 */
export async function listConversations(req, res, next) {
  try {
    const { projectId } = req.params;

    const conversations = await Conversation.find({
      projectId,
      ownerId: req.user._id,
    })
      .select("id title lastMessageAt messages")
      .sort({ lastMessageAt: -1 });

    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title || `Chat about ${new Date(c.createdAt).toLocaleDateString()}`,
        lastMessageAt: c.lastMessageAt,
        messageCount: c.messages.length,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get a specific conversation
 */
export async function getConversation(req, res, next) {
  try {
    const { projectId, conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.projectId.toString() !== projectId) {
      throw new AppError(404, "Conversation not found.", "not_found");
    }

    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(req, res, next) {
  try {
    const { projectId, conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.projectId.toString() !== projectId) {
      throw new AppError(404, "Conversation not found.", "not_found");
    }

    await Conversation.deleteOne({ _id: conversationId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Call Gemini API for tutor response
 */
async function callGemini(systemPrompt, messages) {
  if (!env.ai.apiKey || !env.ai.model) {
    throw new AppError(503, "AI tutor is not configured.", "ai_not_configured");
  }

  try {
    // Format messages for Gemini API
    const geminiMessages = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    // Add system prompt as first user message if not already in history
    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    };

    const url = `${GEMINI_API_URL}/${env.ai.model}:generateContent?key=${env.ai.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();

      console.error("[tutor] Gemini HTTP status:", response.status);
      console.error("[tutor] Gemini response:", errorText);
      
      throw new Error(`Gemini API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();

    // Extract text from Gemini response
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error("Unexpected Gemini API response format");
  } catch (err) {
    console.error("[tutor] Gemini API error:", err);
    throw new AppError(502, "Failed to get AI response. Please try again.", "ai_error");
  }
}
