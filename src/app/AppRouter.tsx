import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { HomePage } from "@/pages/HomePage";

export function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        {/*
          To create multiple pages in your React app, add routes like this:
          - Import your page component at the top
          - Add a Route element with path and element props  
          - The path defines the URL route (e.g., "/profile", "/settings", "/dashboard")
          - The element prop specifies which component to render

          Example:
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Router>
  );
}