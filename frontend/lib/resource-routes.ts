export const materialCollectionPath = (workspaceId: string | number) =>
  `/materials?workspace_id=${encodeURIComponent(String(workspaceId))}`;

export const templateCollectionPath = (workspaceId?: string | number) =>
  workspaceId === undefined
    ? "/templates"
    : `/templates?workspace_id=${encodeURIComponent(String(workspaceId))}`;

export const sessionSortParameter = (sort: "newest" | "title") =>
  sort === "newest" ? "created_at" : "title";

export const materialTypeOptions = [
  "document",
  "presentation",
  "video",
  "audio",
  "image",
  "link",
  "spreadsheet",
  "code",
  "archive",
  "other",
] as const;

export type MaterialFormValues = {
  title: string;
  material_type: string;
  material_date: string;
  description: string;
  content_url: string;
  content: string;
  tags: string;
};

export function buildMaterialUpdatePayload(input: MaterialFormValues) {
  return {
    title: input.title,
    material_type: input.material_type,
    material_date: input.material_date || null,
    description: input.description,
    content_url: input.content_url || null,
    content: input.content,
    tags: input.tags.split(",").map((value) => value.trim()).filter(Boolean),
  };
}

export function buildMaterialCreatePayload(
  workspaceId: string | number,
  input: MaterialFormValues,
) {
  return { workspace_id: Number(workspaceId), ...buildMaterialUpdatePayload(input) };
}

export type TemplateFormValues = {
  name: string;
  category: string;
  description: string;
  content: string;
};

export function buildTemplateUpdatePayload(input: TemplateFormValues) {
  return {
    name: input.name,
    description: input.description || null,
    template_type: input.category,
    category: input.category,
    config_json: { content: input.content },
  };
}

export function buildTemplateCreatePayload(
  workspaceId: string | number | null,
  input: TemplateFormValues,
) {
  return {
    workspace_id: workspaceId === null ? null : Number(workspaceId),
    ...buildTemplateUpdatePayload(input),
  };
}

export type TeachingSessionFormValues = {
  title: string;
  topic: string;
  description: string;
  audience: string;
  difficulty: string;
  duration_minutes: string | number;
  session_type: string;
  session_date: string;
  status: string;
  notes: string;
};

export function buildTeachingSessionPayload(input: TeachingSessionFormValues) {
  return {
    title: input.title,
    topic: input.topic || null,
    description: input.description || null,
    audience: input.audience || null,
    difficulty: input.difficulty || null,
    duration_minutes: Number(input.duration_minutes),
    session_type: input.session_type || null,
    session_date: input.session_date || null,
    status: input.status,
    notes: input.notes || null,
  };
}
