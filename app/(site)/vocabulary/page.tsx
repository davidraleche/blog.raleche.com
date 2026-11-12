import { WordGamePage } from "@/components/WordGamePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vocabulary: what does it mean?", description: "Words used by the tech leaders we interview. Pick the right meaning and win tokens.", alternates: { canonical: "/vocabulary" } };

export default async function Vocabulary({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <WordGamePage kind="vocab" questionRef={typeof q === "string" ? q : undefined} />;
}
