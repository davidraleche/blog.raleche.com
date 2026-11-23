// Write the "why read it" pitch for every mentioned book that doesn't have one yet (Gemini on Vertex AI).
//   npx tsx scripts/write-book-pitches.ts [limit]
import { db } from "../lib/db";
import { fillBookPitches } from "../lib/book-pitch";

async function main() {
  const n = await fillBookPitches(Number(process.argv[2]) || 200);
  console.log(`Wrote ${n} book pitches`);
}

main().finally(() => db.$disconnect());
