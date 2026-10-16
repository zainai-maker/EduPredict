// Browser requests use the Vite /api same-origin proxy (see README).
// Session token is stored in an HttpOnly cookie, not localStorage/sessionStorage.
const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function request(path, token = null, init = {}) {
  const { headers: extras, ...options } = init;
  const headers = new Headers(extras || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set("X-EduPredict-Request", "1");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string"
      ? body.detail
      : Array.isArray(body.detail) ? body.detail.map((d) => d.msg).join("; ") : `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

export const json = (method, value) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
