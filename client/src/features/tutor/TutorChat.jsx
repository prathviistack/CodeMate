import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader, AlertCircle } from "lucide-react";
import { projectsApi } from "../../lib/api.js";

export default function TutorChat({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!input.trim() || loading) return;

      const userMessage = input.trim();
      setInput("");
      setError(null);

      // Optimistically add user message
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

      try {
        setLoading(true);
        const response = await projectsApi.tutorChat(projectId, {
          message: userMessage,
          conversationId,
        });

        setConversationId(response.id);
        setMessages(response.messages.map((m) => ({ role: m.role, content: m.content })));
      } catch (err) {
        setError(err.friendly || "Failed to get response from tutor. Please try again.");
        // Remove the optimistic message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [input, loading, conversationId, projectId]
  );



  return (
    <div className="flex flex-col gap-4">
      <div className="card flex max-h-96 flex-col overflow-hidden">
        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="text-sm text-muted">
                <p className="mb-2 text-base font-medium">Ask about this codebase</p>
                <p>Chat with an AI tutor powered by Gemini. Ask questions about the code, architecture, or how to use the repository.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`shrink-0 text-xs font-semibold ${msg.role === "user" ? "text-muted" : "text-purple"}`}>
                    {msg.role === "user" ? "You" : "Claude"}
                  </div>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-sm leading-6 ${
                      msg.role === "user" ? "bg-elevated text-ink" : "bg-purple/10 text-ink"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader size={16} className="animate-spin" />
                  Gemini is thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="border-t border-border p-3">
          {error && (
            <div className="mb-2 flex items-start gap-2 rounded-sm bg-danger/10 px-2 py-1 text-xs text-danger">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the code..."
              disabled={loading}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="rounded-md bg-purple px-3 py-2 text-white disabled:opacity-50 hover:bg-purple/90"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
