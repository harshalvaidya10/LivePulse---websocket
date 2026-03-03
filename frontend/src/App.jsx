import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import MatchDetail from "./pages/MatchDetail";
import Admin from "./pages/Admin";
import AdminPanel from "./pages/AdminPanel";
import RequireAdmin from "./components/RequireAdmin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/matches/:id" element={<MatchDetail />} />

      <Route path="/admin" element={<Admin />} />
      <Route
        path="/admin/panel"
        element={
          <RequireAdmin>
            <AdminPanel />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}