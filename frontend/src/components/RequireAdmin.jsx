import { Navigate, useLocation } from "react-router-dom";

const STORAGE_KEY = "livepulse_admin_key";

export default function RequireAdmin({ children }) {
    const location = useLocation();
    const key = localStorage.getItem(STORAGE_KEY) || "";

    // If no key stored, redirect to /admin (lock screen)
    // We’ll show the lock screen there.
    if (!key) {
        return <Navigate to="/admin" state={{ from: location }} replace />;
    }

    return children;
}