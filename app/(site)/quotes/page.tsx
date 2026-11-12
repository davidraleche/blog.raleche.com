import { WordGamePage } from "@/components/WordGamePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes: who said it?", description: "Lines from our interviews with tech leaders. Guess who said it and win tokens.", alternates: { canonical: "/quotes" } };

export default async function Quotes({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <WordGamePage kind="quote" questionRef={typeof q === "string" ? q : undefined} />;
}
