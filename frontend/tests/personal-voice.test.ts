import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const login = readFileSync(resolve(process.cwd(), "app/login/login-form.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "components/app-shell.tsx"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "app/(protected)/dashboard/page.tsx"), "utf8");

describe("personal product voice", () => {
  it("removes institutional positioning from the primary experience", () => {
    const primaryExperience = `${login}\n${shell}\n${dashboard}`.toLowerCase();
    expect(primaryExperience).not.toContain("academic workspace");
    expect(primaryExperience).not.toContain("administrator institusi");
    expect(primaryExperience).not.toContain("nama@institusi.ac.id");
    expect(primaryExperience).toContain("ruang kerja pribadi");
  });
});
