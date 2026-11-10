import { WordGamePage } from "@/components/WordGamePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vocabulary: what does it mean?", description: "Words used by the tech leaders we interview. Pick the right meaning and win tokens.", alternates: { canonical: "/vocabulary" } };

export default function Vocabulary() {
  return <WordGamePage kind="vocab" />;
}
