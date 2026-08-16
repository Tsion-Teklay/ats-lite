import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AcceptInvite from "./pages/AcceptInvite";
import CareerPage from "./pages/CareerPage";
import Dashboard from "./pages/Dashboard";
import JobApply from "./pages/JobApply";
import Jobs from "./pages/Jobs";
import Login from "./pages/Login";
import Pipeline from "./pages/Pipeline";
import Register from "./pages/Register";
import Team from "./pages/Team";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route path="/careers/:slug" element={<CareerPage />} />
      <Route path="/careers/:slug/jobs/:jobId" element={<JobApply />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="team" element={<Team />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <div className="grid min-h-screen place-items-center px-4 text-center">
            <div>
              <p className="text-3xl font-semibold text-slate-900">404</p>
              <p className="mt-2 text-slate-500">That page does not exist.</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
