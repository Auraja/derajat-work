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
  session_type: string;
  instructors: string;
  start_date: string;
  end_date: string;
  mode: string;
  status: string;
  location: string;
  participant_count: string | number;
  participant_label: string;
  audience: string;
  topic: string;
  difficulty: string;
  duration_minutes: string | number;
  description: string;
  notes: string;
};

export type TeachingActivityPayload = {
  type: string;
  startDate: string;
  endDate: string;
  mode?: string | null;
};

export function buildTeachingSessionPayload(
  input: TeachingSessionFormValues,
  additionalActivities: TeachingActivityPayload[] = [],
  scheduledAt?: string | null,
) {
  const instructors = input.instructors
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const participantCount = String(input.participant_count).trim();
  const duration = String(input.duration_minutes).trim();
  return {
    title: input.title.trim(),
    topic: input.topic.trim() || null,
    description: input.description.trim() || null,
    audience: input.audience.trim() || null,
    location: input.location.trim() || null,
    participant_count: participantCount ? Number(participantCount) : null,
    participant_label: input.participant_label.trim() || null,
    difficulty: input.difficulty || null,
    instructor: instructors[0] ?? null,
    instructors,
    activities: [
      {
        type: input.session_type,
        startDate: input.start_date,
        endDate: input.end_date,
        mode: input.mode || null,
      },
      ...additionalActivities,
    ],
    ...(scheduledAt
      ? { scheduled_at: `${input.start_date}${scheduledAt.slice(10)}` }
      : {}),
    duration_minutes: duration ? Number(duration) : null,
    session_type: input.session_type,
    session_date: input.start_date,
    status: input.status,
    notes: input.notes.trim() || null,
  };
}
