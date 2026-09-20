export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  const response = await fetch(path.startsWith("/api/") ? path : `/api/v1${path.startsWith("/") ? path : `/${path}`}`, {
    ...init, headers, credentials: "include",
  });
  if (response.status === 401) {
    if (typeof window !== "undefined") window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiError(401, "Sesi Anda telah berakhir. Silakan masuk kembali.");
  }
  const text = await response.text();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let data: unknown = text || null;
  if (text && contentType.includes("json")) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new ApiError(response.status, "Respons server tidak valid.", text);
      }
    }
  }
  if (!response.ok) {
    const body = data !== null && typeof data === "object"
      ? data as { detail?: unknown; message?: unknown }
      : null;
    const plainText = contentType.startsWith("text/plain") ? text.trim() : "";
    const message = typeof body?.detail === "string"
      ? body.detail
      : typeof body?.message === "string"
        ? body.message
        : plainText || "Permintaan tidak dapat diproses.";
    throw new ApiError(
      response.status,
      message,
      data,
    );
  }
  return data as T;
}

export const jsonBody = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
