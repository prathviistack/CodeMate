import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";

function FullScreenLoader() {
  return (
    <div className="grid h-full place-items-center">
      <div className="w-64 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/app" replace />;
  return <Outlet />;
}
