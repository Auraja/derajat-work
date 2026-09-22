import { redirect } from "next/navigation";

export default async function LegacyEditSessionPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  redirect(`/workspaces/${slug}/teaching-sessions/${id}/edit`);
}
