import { Routes, Route, Navigate } from "react-router-dom";
import { Route as RouteIcon, Bot, ListChecks, TrendingUp } from "lucide-react";
import AppLayout from "./components/layout/AppLayout.jsx";
import PlannedFeature from "./components/common/PlannedFeature.jsx";
import { ProtectedRoute, GuestRoute } from "./features/auth/RouteGuards.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import ProjectWorkspaceLayout from "./pages/ProjectWorkspaceLayout.jsx";
import ProjectOverviewPage from "./pages/ProjectOverviewPage.jsx";
import ProjectFilesPage from "./pages/ProjectFilesPage.jsx";
import ProjectTutorPage from "./pages/ProjectTutorPage.jsx";
import ProjectLessonsPage from "./pages/ProjectLessonsPage.jsx";
import ProjectLessonDetailPage from "./pages/ProjectLessonDetailPage.jsx";
import ProjectQuizzesPage from "./pages/ProjectQuizzesPage.jsx";
import ProjectQuizPage from "./pages/ProjectQuizPage.jsx";
import ExplorerRedirectPage from "./pages/ExplorerRedirectPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";

const planned = [
  { path: "progress", title: "Learning Progress", icon: TrendingUp, phase: "Phase 8", description: "Progress calculated from your real lesson and quiz records." },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectWorkspaceLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path="files" element={<ProjectFilesPage />} />
            <Route path="tutor" element={<ProjectTutorPage />} />
            <Route path="lessons" element={<ProjectLessonsPage />} />
            <Route path="lessons/:lessonId" element={<ProjectLessonDetailPage />} />
            <Route path="quizzes" element={<ProjectQuizzesPage />} />
            <Route path="quizzes/:quizId" element={<ProjectQuizPage />} />
          </Route>
          <Route path="explorer" element={<ExplorerRedirectPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {planned.map(({ path, ...rest }) => (
            <Route key={path} path={path} element={<PlannedFeature {...rest} />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
