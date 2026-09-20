import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { readLimitedBody } from "@/lib/request-limits";

const backend = process.env.BACKEND_INTERNAL_URL ?? process.env.BACKEND_URL ?? process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const url = new URL(`/api/${path.join("/")}${request.nextUrl.search}`, backend);
  const headers = new Headers(request.headers);
  const cloudflareAddress = headers.get("CF-Connecting-IP")?.trim();
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("CF-Connecting-IP");
  if (cloudflareAddress && isIP(cloudflareAddress)) {
    headers.set("CF-Connecting-IP", cloudflareAddress);
  }
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await readLimitedBody(request) as Uint8Array<ArrayBuffer>;
    } catch (error) {
      if (error instanceof RangeError) {
        return NextResponse.json({ detail: "Request body too large" }, { status: 413 });
      }
      throw error;
    }
  }
  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });
  return new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE, forward as OPTIONS };
