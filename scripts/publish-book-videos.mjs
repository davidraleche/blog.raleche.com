#!/usr/bin/env node
// Upload books' 5-second share videos (made by scripts/make-book-video.mjs) to the raleche-story-videos bucket
// and add them to its manifest.json under "books". The Books page shows the share panel for each one,
// and /books/<slug>/video/<vertical|wide>.mp4 streams the files.
//
//   node scripts/publish-book-videos.mjs <video dir> <book.json>...
import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const BUCKET = process.env.STORY_VIDEO_BUCKET || "raleche-story-videos";
const ACCOUNT = process.env.GCLOUD_ACCOUNT || "davidr@tech-team-strategy.com";
const [dir, ...bookFiles] = process.argv.slice(2);
if (!dir || !bookFiles.length) {
  console.error("usage: node scripts/publish-book-videos.mjs <video dir> <book.json>...");
  process.exit(1);
}
const gcloud = (args, opts = {}) => execFileSync("gcloud", [...args, `--account=${ACCOUNT}`], { encoding: "utf8", ...opts });
const tag = (s) => "#" + s.replace(/[^A-Za-z0-9]/g, "");
const VERB = { recommends: "recommends", reading: "is reading", influenced: "was shaped by", wrote: "wrote" };

let manifest = { stories: {} };
try {
  manifest = JSON.parse(gcloud(["storage", "cat", `gs://${BUCKET}/manifest.json`], { stdio: ["ignore", "pipe", "ignore"] }));
} catch {}
manifest.books ||= {};

for (const f of bookFiles) {
  const b = JSON.parse(readFileSync(f, "utf8"));
  const formats = [];
  for (const format of ["vertical", "wide"]) {
    const file = join(dir, `${b.slug}-${format}.mp4`);
    if (!existsSync(file)) continue;
    gcloud(["storage", "cp", file, `gs://${BUCKET}/books/${b.slug}/${format}.mp4`, "--content-type=video/mp4", "--quiet"], { stdio: "ignore" });
    formats.push(format);
  }
  if (!formats.length) { console.warn("skip (no video):", b.slug); continue; }
  const short = b.title.split(":")[0];
  manifest.books[b.slug] = {
    formats,
    speaker: b.who,
    // The link to the book is added by the page (raleche.com/books/<slug>), so it is not in the text.
    text: `${b.who} ${VERB[b.relation ?? "recommends"] ?? "recommends"} "${short}" by ${b.author}.\n\n"${b.note.replace(/^["“]|["”]$/g, "")}"`,
    credit: "",
    hashtags: [...new Set(["#Books", tag(b.who), tag(b.author), tag(short), "#Leadership"])].join(" "),
    updatedAt: new Date().toISOString(),
  };
  console.log("uploaded", b.slug, formats.join(", "));
}
manifest.updatedAt = new Date().toISOString();
const tmp = join(mkdtempSync(join(tmpdir(), "book-videos-")), "manifest.json");
writeFileSync(tmp, JSON.stringify(manifest, null, 1));
gcloud(["storage", "cp", tmp, `gs://${BUCKET}/manifest.json`, "--content-type=application/json", "--cache-control=no-cache", "--quiet"], { stdio: "ignore" });
console.log(`manifest: ${Object.keys(manifest.stories ?? {}).length} stories, ${Object.keys(manifest.books).length} books`);
