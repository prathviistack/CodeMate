import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projectsApi } from "../lib/api.js";
import "./ProjectQuizzesPage.css";

export default function ProjectQuizzesPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuizzes();
  }, [projectId]);

  async function loadQuizzes() {
    try {
      setLoading(true);
      setError("");
      const data = await projectsApi.quizzes(projectId);
      setQuizzes(data);
    } catch (err) {
      setError(err.friendly || "Failed to load quizzes");
      console.error("Error loading quizzes:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="quizzes-page">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="quizzes-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="quizzes-page">
        <div className="empty-state">
          <h2>No quizzes yet</h2>
          <p>Quizzes are automatically generated along with lessons after code analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="quizzes-page">
      <div className="quizzes-header">
        <h1>Quizzes</h1>
        <p>Test your understanding of the codebase</p>
      </div>

      <div className="quizzes-list">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="quiz-item">
            <div className="quiz-info">
              <h3>{quiz.title}</h3>
              <p className="quiz-description">{quiz.description}</p>

              <div className="quiz-meta">
                <span className="question-count">{quiz.questions?.length || 0} questions</span>
                <span className="difficulty" data-difficulty={quiz.difficulty}>
                  {quiz.difficulty}
                </span>
                <span className="time-estimate">⏱ {quiz.estimatedMinutes} min</span>
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={() => navigate(`/app/projects/${projectId}/quizzes/${quiz.id}`)}
            >
              Start Quiz →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
