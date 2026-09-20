import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BODY_BYTES, requestBodyTooLarge } from "@/lib/request-limits";

describe("request body limits", () => {
  it("rejects declared or buffered bodies above the limit", () => {
    expect(requestBodyTooLarge(String(MAX_REQUEST_BODY_BYTES + 1))).toBe(true);
    expect(requestBodyTooLarge(String(MAX_REQUEST_BODY_BYTES))).toBe(false);
    expect(requestBodyTooLarge(null, MAX_REQUEST_BODY_BYTES + 1)).toBe(true);
  });
});
