import { describe, expect, it } from "vitest";
import {
  buildMaterialCreatePayload,
  buildMaterialUpdatePayload,
  buildTemplateCreatePayload,
  buildTemplateUpdatePayload,
  buildTeachingSessionPayload,
  materialCollectionPath,
  materialTypeOptions,
  sessionSortParameter,
  templateCollectionPath,
} from "@/lib/resource-routes";

describe("resource API routes", () => {
  it("builds exact material create and update contracts", () => {
    const values = {
      title: "Handout",
      material_type: "document",
      material_date: "2026-09-10",
      description: "Ringkasan",
      content_url: "",
      content: "Isi",
      tags: "ai, dasar",
    };

    expect(buildMaterialCreatePayload(7, values)).toEqual({
      workspace_id: 7,
      title: "Handout",
      material_type: "document",
      material_date: "2026-09-10",
      description: "Ringkasan",
      content_url: null,
      content: "Isi",
      tags: ["ai", "dasar"],
    });
    expect(buildMaterialUpdatePayload(values)).toEqual({
      title: "Handout",
      material_type: "document",
      material_date: "2026-09-10",
      description: "Ringkasan",
      content_url: null,
      content: "Isi",
      tags: ["ai", "dasar"],
    });
  });

  it("scopes material listings to the active workspace", () => {
    expect(materialCollectionPath(7)).toBe("/materials?workspace_id=7");
  });

  it("uses the template collection placeholder contract", () => {
    expect(templateCollectionPath(7)).toBe("/templates?workspace_id=7");
    expect(templateCollectionPath()).toBe("/templates");
  });

  it("maps UI sort choices to backend query values", () => {
    expect(sessionSortParameter("newest")).toBe("created_at");
    expect(sessionSortParameter("title")).toBe("title");
  });

  it("builds exact template create and update contracts", () => {
    const values = {
      name: "Lesson",
      category: "lesson",
      description: "Reusable",
      content: "Outline",
    };

    expect(buildTemplateCreatePayload(7, values)).toEqual({
      workspace_id: 7,
      name: "Lesson",
      description: "Reusable",
      template_type: "lesson",
      category: "lesson",
      config_json: { content: "Outline" },
    });
    expect(buildTemplateUpdatePayload(values)).toEqual({
      name: "Lesson",
      description: "Reusable",
      template_type: "lesson",
      category: "lesson",
      config_json: { content: "Outline" },
    });
  });

  it("only offers material types accepted by the API", () => {
    expect(materialTypeOptions).toEqual([
      "document", "presentation", "video", "audio", "image",
      "link", "spreadsheet", "code", "archive", "other",
    ]);
  });

  it("builds the teaching-session schema used by the API", () => {
    expect(buildTeachingSessionPayload({
      title: "AI Basics",
      topic: "Machine Learning",
      description: "Introduction",
      audience: "Beginner",
      difficulty: "beginner",
      duration_minutes: "90",
      session_type: "workshop",
      session_date: "",
      status: "preparing",
      notes: "Bring laptop",
    })).toEqual({
      title: "AI Basics",
      topic: "Machine Learning",
      description: "Introduction",
      audience: "Beginner",
      difficulty: "beginner",
      duration_minutes: 90,
      session_type: "workshop",
      session_date: null,
      status: "preparing",
      notes: "Bring laptop",
    });
  });
});
