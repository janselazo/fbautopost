/**
 * Backend base URL for API requests.
 * In development, when the app is served from localhost/127.0.0.1, returns "" so requests go through the Vite proxy to localhost:3000 (any port).
 * Otherwise uses VITE_BACKEND_URL (e.g. preview or production).
 */
export function getBackendUrl(): string {
  if (typeof window === "undefined") return import.meta.env.VITE_BACKEND_URL || "";
  const { hostname } = window.location;
  const isLocalDev =
    import.meta.env.DEV &&
    (hostname === "localhost" || hostname === "127.0.0.1");
  if (isLocalDev) return "";
  return import.meta.env.VITE_BACKEND_URL || "";
}
