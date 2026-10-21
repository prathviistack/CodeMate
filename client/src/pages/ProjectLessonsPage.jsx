import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projectsApi } from "../lib/api.js";
import "./ProjectLessonsPage.css";

export default function ProjectLessonsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLessons();
  }, [projectId]);

  async function loadLessons() {
    try {
      setLoading(true);
      setError("");
      const data = await projectsApi.lessons(projectId);
      setLessons(data);
    } catch (err) {
      setError(err.friendly || "Failed to load lessons");
      console.error("Error loading lessons:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="lessons-page">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="lessons-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="lessons-page">
        <div className="empty-state">
          <h2>No lessons yet</h2>
          <p>Lessons are automatically generated after code analysis completes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lessons-page">
      <div className="lessons-header">
        <h1>Learning Path</h1>
        <p>Complete these lessons to understand the codebase</p>
      </div>

      <div className="lessons-grid">
        {lessons.map((lesson) => (
          <div key={lesson.id} className="lesson-card">
            <div className="lesson-badge" data-difficulty={lesson.difficulty}>
              {lesson.difficulty}
            </div>
            <h3>{lesson.title}</h3>
            <p className="lesson-description">{lesson.description}</p>

            <div className="lesson-meta">
              <span className="time-estimate">⏱ {lesson.estimatedMinutes} min</span>
              {lesson.keyPoints && lesson.keyPoints.length > 0 && (
                <span className="key-points">{lesson.keyPoints.length} key points</span>
              )}
            </div>

            <button className="btn-primary" onClick={() => navigate(`/app/projects/${projectId}/lessons/${lesson.id}`)}>
              Start Lesson
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
