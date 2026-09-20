import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("global CSS cascade", () => {
  it("keeps element resets in the base layer so utility colors win", () => {
    expect(css).toMatch(/@layer base\s*\{[\s\S]*a\s*\{\s*color:\s*inherit;/);
  });

  it("visually hides mobile table headers without removing them from accessibility", () => {
    const mobileHeaderRule = css.match(/\.responsive-table thead\s*\{([^}]*)\}/)?.[1];

    expect(mobileHeaderRule).toBeDefined();
    expect(mobileHeaderRule).not.toMatch(/display:\s*none/);
    expect(mobileHeaderRule).toMatch(/position:\s*absolute/);
    expect(mobileHeaderRule).toMatch(/overflow:\s*hidden/);
  });

  it("shows a visible focus treatment around a focused skill choice", () => {
    const focusRule = css.match(/\.skill-choice:focus-within\s*\{([^}]*)\}/)?.[1];

    expect(focusRule).toMatch(/border-color:/);
    expect(focusRule).toMatch(/box-shadow:/);
  });
});
