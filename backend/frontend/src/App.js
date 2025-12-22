import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GroupStudentsPage from "./pages/GroupStudentsPage";
import Dashboard from "./pages/Dashboard";
import HeadStudentsPage from "./pages/HeadStudentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ProtectedRoute from "./utils/ProtectedRoute";
import StudentDashboard from "./pages/StudentDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head/students"
          element={
            <ProtectedRoute>
              <HeadStudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/group/:id"
          element={
            <ProtectedRoute>
              <GroupStudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
        path="/student"
        element={
          <ProtectedRoute>
            <StudentDashboard />
          </ProtectedRoute>
        }
        />
      </Routes>
    </BrowserRouter >
  );
}

export default App;
