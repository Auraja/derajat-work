import { redirect } from "next/navigation";

export default async function LegacySessionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/workspaces/${slug}/teaching-sessions`);
}
