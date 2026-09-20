import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as forwardApiPost } from "@/app/api/[...path]/route";
import { proxy } from "@/proxy";
import { isProtectedPath, safeNextPath } from "@/lib/auth-routes";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isProtectedPath", () => {
  it("keeps login and Next internals public", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/_next/static/a.js")).toBe(false);
  });

  it("protects product routes", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/workspaces/teaching")).toBe(true);
  });

  it("only accepts same-origin application paths after login", () => {
    expect(safeNextPath("/workspaces/bisa-ai")).toBe("/workspaces/bisa-ai");
    expect(safeNextPath("//evil.example/path")).toBe("/dashboard");
    expect(safeNextPath("https://evil.example/path")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });

  it("rejects backslashes and control characters in next paths", () => {
    expect(safeNextPath("/\\\\evil.example/path")).toBe("/dashboard");
    expect(safeNextPath("/safe\\path")).toBe("/dashboard");
    expect(safeNextPath("/safe\npath")).toBe("/dashboard");
    expect(safeNextPath("/safe\u0000path")).toBe("/dashboard");
  });
});

describe("API proxy", () => {
  it("forwards Cloudflare client identity from the loopback-only origin", async () => {
    let forwardedHeaders = new Headers();
    vi.stubGlobal("fetch", vi.fn(async (_url: URL, init: RequestInit) => {
      forwardedHeaders = new Headers(init.headers);
      return new Response("{}", { status: 401, headers: { "content-type": "application/json" } });
    }));
    const request = new NextRequest("https://work.example/api/v1/auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "198.51.100.10", "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "wrong-password" }),
    });

    await forwardApiPost(request, { params: Promise.resolve({ path: ["v1", "auth", "login"] }) });

    expect(forwardedHeaders.get("CF-Connecting-IP")).toBe("198.51.100.10");
  });
});

describe("proxy", () => {
  it("keeps login reachable when an invalid session cookie is present", () => {
    const request = new NextRequest("https://work.example/login", {
      headers: { cookie: "derajat_session=invalid" },
    });

    const response = proxy(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
