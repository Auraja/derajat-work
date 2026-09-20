import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "@/lib/api";

describe("api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves the HTTP status for a plain-text upstream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Layanan tidak tersedia", {
          status: 502,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(api("/health")).rejects.toMatchObject({
      name: "Error",
      status: 502,
      message: "Layanan tidak tersedia",
    } satisfies Partial<ApiError>);
  });

  it("turns malformed JSON into a stable protocol error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{invalid", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api("/health")).rejects.toMatchObject({
      status: 200,
      message: "Respons server tidak valid.",
    } satisfies Partial<ApiError>);
  });

  it("uses a stable message when FastAPI detail is structured", async () => {
    const detail = [{ loc: ["body", "status"], msg: "Input should be valid" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ detail }, { status: 422 })),
    );

    await expect(api("/teaching/sessions")).rejects.toMatchObject({
      status: 422,
      message: "Permintaan tidak dapat diproses.",
      details: { detail },
    } satisfies Partial<ApiError>);
  });

  it("returns null for an empty 204 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(api<null>("/auth/logout", { method: "POST" })).resolves.toBeNull();
  });
});