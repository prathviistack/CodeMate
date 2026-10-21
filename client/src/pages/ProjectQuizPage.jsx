import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projectsApi } from "../lib/api.js";
import "./ProjectQuizPage.css";

export default function ProjectQuizPage() {
  const { projectId, quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, [projectId, quizId]);

  async function loadQuiz() {
    try {
      setLoading(true);
      setError("");
      const data = await projectsApi.quiz(projectId, quizId);
      setQuiz(data);
      setAnswers(new Array(data.questions?.length || 0).fill(null));
    } catch (err) {
      setError(err.friendly || "Failed to load quiz");
      console.error("Error loading quiz:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (answers.includes(null)) {
      setError("Please answer all questions before submitting");
      return;
    }

    try {
      setError("");
      const data = await projectsApi.submitQuizAttempt(projectId, quizId, { answers });
      setResults(data);
      setSubmitted(true);
    } catch (err) {
      setError(err.friendly || "Failed to submit quiz");
      console.error("Error submitting quiz:", err);
    }
  }

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !submitted) {
    return (
      <div className="quiz-page">
        <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/quizzes`)}>
          ← Back to Quizzes
        </button>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-page">
        <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/quizzes`)}>
          ← Back to Quizzes
        </button>
        <div className="empty-state">Quiz not found</div>
      </div>
    );
  }

  if (submitted && results) {
    return (
      <div className="quiz-page">
        <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/quizzes`)}>
          ← Back to Quizzes
        </button>

        <div className="results-container">
          <h1>Quiz Results</h1>

          <div className="score-display">
            <div className="score-circle">
              <span className="score-number">{results.score}%</span>
              <span className="score-label">Score</span>
            </div>
            <div className="score-summary">
              <p>You got <strong>{results.correct} out of {results.total}</strong> questions correct.</p>
              {results.score >= 80 && <p className="positive">Great job! You've mastered this material.</p>}
              {results.score >= 60 && results.score < 80 && <p className="warning">Good effort! Review the material to improve.</p>}
              {results.score < 60 && <p className="error">Keep practicing to improve your score.</p>}
            </div>
          </div>

          <div className="feedback-section">
            <h2>Review Your Answers</h2>
            {results.feedback.map((item, idx) => (
              <div key={idx} className={`feedback-item ${item.correct ? "correct" : "incorrect"}`}>
                <div className="feedback-header">
                  <span className="question-number">Question {item.questionIndex + 1}</span>
                  <span className={`result-badge ${item.correct ? "correct" : "incorrect"}`}>
                    {item.correct ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                </div>
                <p className="feedback-text">{item.explanation}</p>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={() => navigate(`/app/projects/${projectId}/quizzes`)}>
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIdx];
  const progress = ((currentQuestionIdx + 1) / quiz.questions.length) * 100;

  return (
    <div className="quiz-page">
      <button className="btn-back" onClick={() => navigate(`/app/projects/${projectId}/quizzes`)}>
        ← Back to Quizzes
      </button>

      <div className="quiz-header">
        <h1>{quiz.title}</h1>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="progress-text">
          Question {currentQuestionIdx + 1} of {quiz.questions.length}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="quiz-container">
        <div className="question-container">
          <h2>{currentQuestion.text}</h2>

          <div className="options-list">
            {currentQuestion.options.map((option, idx) => (
              <label key={idx} className="option-label">
                <input
                  type="radio"
                  name="option"
                  value={idx}
                  checked={answers[currentQuestionIdx] === idx}
                  onChange={() => {
                    const newAnswers = [...answers];
                    newAnswers[currentQuestionIdx] = idx;
                    setAnswers(newAnswers);
                  }}
                />
                <span className="option-text">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="navigation-buttons">
          <button
            className="btn-secondary"
            onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
            disabled={currentQuestionIdx === 0}
          >
            ← Previous
          </button>

          <div className="question-dots">
            {quiz.questions.map((_, idx) => (
              <button
                key={idx}
                className={`dot ${idx === currentQuestionIdx ? "active" : ""} ${answers[idx] !== null ? "answered" : ""}`}
                onClick={() => setCurrentQuestionIdx(idx)}
                title={`Question ${idx + 1}`}
              />
            ))}
          </div>

          {currentQuestionIdx < quiz.questions.length - 1 ? (
            <button
              className="btn-secondary"
              onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
            >
              Next →
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit}>
              Submit Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
