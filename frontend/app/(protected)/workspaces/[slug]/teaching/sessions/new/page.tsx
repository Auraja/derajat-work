import { redirect } from "next/navigation";

export default async function LegacyNewSessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/workspaces/${slug}/teaching-sessions/new`);
}
