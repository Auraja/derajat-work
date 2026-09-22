import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "app/(protected)/workspaces/[slug]/teaching/sessions");

describe("legacy teaching session redirects", () => {
  it.each([
    ["page.tsx", "/workspaces/${slug}/teaching-sessions"],
    ["new/page.tsx", "/workspaces/${slug}/teaching-sessions/new"],
    ["[id]/page.tsx", "/workspaces/${slug}/teaching-sessions/${id}"],
    ["[id]/edit/page.tsx", "/workspaces/${slug}/teaching-sessions/${id}/edit"],
  ])("redirects %s to the canonical module", (path, target) => {
    const source = readFileSync(resolve(root, path), "utf8");
    expect(source).toContain("redirect(");
    expect(source).toContain(target);
  });
});
