import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projectsApi } from "../lib/api.js";
import "./ProjectLessonDetailPage.css";

export default function ProjectLessonDetailPage() {
  const { projectId, lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLesson();
  }, [projectId, lessonId]);

  async function loadLesson() {
    try {
      setLoading(true);
      setError("");
      const data = await projectsApi.lesson(projectId, lessonId);
      setLesson(data);
    } catch (err) {
      setError(err.friendly || "Failed to load lesson");
      console.error("Error loading lesson:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="lesson-detail-page">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-detail-page">
        <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/lessons`)}>
          ← Back to Lessons
        </button>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="lesson-detail-page">
        <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/lessons`)}>
          ← Back to Lessons
        </button>
        <div className="empty-state">Lesson not found</div>
      </div>
    );
  }

  return (
    <div className="lesson-detail-page">
      <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/lessons`)}>
        ← Back to Lessons
      </button>

      <div className="lesson-header">
        <div className="header-top">
          <h1>{lesson.title}</h1>
          <span className="difficulty-badge" data-difficulty={lesson.difficulty}>
            {lesson.difficulty}
          </span>
        </div>
        <p className="lesson-description">{lesson.description}</p>
        <div className="lesson-meta">
          <span>⏱ {lesson.estimatedMinutes} minutes</span>
        </div>
      </div>

      <div className="lesson-content">
        <div className="content-main">
          <div className="markdown-content">
            {lesson.content.split("\n").map((line, idx) => {
              if (line.startsWith("# ")) {
                return (
                  <h2 key={idx} className="markdown-h2">
                    {line.substring(2)}
                  </h2>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h3 key={idx} className="markdown-h3">
                    {line.substring(3)}
                  </h3>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <li key={idx} className="markdown-li">
                    {line.substring(2)}
                  </li>
                );
              }
              if (line.trim() === "") {
                return <br key={idx} />;
              }
              return (
                <p key={idx} className="markdown-p">
                  {line}
                </p>
              );
            })}
          </div>

          {lesson.keyPoints && lesson.keyPoints.length > 0 && (
            <div className="key-points-section">
              <h3>Key Points</h3>
              <ul>
                {lesson.keyPoints.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {lesson.codeExamples && lesson.codeExamples.length > 0 && (
            <div className="code-examples-section">
              <h3>Code Examples</h3>
              {lesson.codeExamples.map((example, idx) => (
                <div key={idx} className="code-example">
                  <div className="example-header">
                    <h4>{example.title}</h4>
                    <span className="language-badge">{example.language}</span>
                  </div>
                  <pre className="code-block">
                    <code>{example.code}</code>
                  </pre>
                  <p className="example-explanation">{example.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="content-sidebar">
          {lesson.relatedFiles && lesson.relatedFiles.length > 0 && (
            <div className="related-files-box">
              <h4>Related Files</h4>
              <ul>
                {lesson.relatedFiles.map((file, idx) => (
                  <li key={idx}>
                    <code>{file.path}</code>
                    {file.relevance && <p className="file-relevance">{file.relevance}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="quiz-cta">
            <button
              className="btn-primary"
              onClick={() => navigate(`/app/projects/${projectId}/quizzes`)}
            >
              Test Your Knowledge →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
