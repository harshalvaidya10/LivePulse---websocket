import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export const api = axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
});

// Optional: normalize errors so UI can show message easily
export function getErrorMessage(err) {
    return (
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong"
    );
}