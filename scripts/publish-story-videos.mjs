#!/usr/bin/env node
// Upload the stories' mini videos to the raleche-story-videos bucket and refresh its manifest.json.
// The story page reads the manifest to show the "Share this story as a mini video" panel,
// and /story/<slug>/video/<vertical|wide>.mp4 streams the files to readers.
//
//   node scripts/publish-story-videos.mjs <dir with <slug>-vertical.mp4 / <slug>-wide.mp4> <video-plan.json>
//
// video-plan.json: [{ slug, speaker, role, hook1, hook2, quotes[], kind, tag, photo: { artist, license } }]
// Videos already in the manifest are uploaded again (overwritten); stories missing from this run are kept.
import { execFileSync } from "child_process";
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const BUCKET = process.env.STORY_VIDEO_BUCKET || "raleche-story-videos";
const ACCOUNT = process.env.GCLOUD_ACCOUNT || "davidr@tech-team-strategy.com";
const [dir, planFile] = process.argv.slice(2);
if (!dir || !planFile) {
  console.error("usage: node scripts/publish-story-videos.mjs <video dir> <video-plan.json>");
  process.exit(1);
}
const gcloud = (args, opts = {}) => execFileSync("gcloud", [...args, `--account=${ACCOUNT}`], { encoding: "utf8", ...opts });
const plan = Object.fromEntries(JSON.parse(readFileSync(planFile, "utf8")).map((o) => [o.slug, o]));
const tag = (s) => "#" + s.replace(/[^A-Za-z0-9]/g, "");

let manifest = { stories: {} };
try {
  manifest = JSON.parse(gcloud(["storage", "cat", `gs://${BUCKET}/manifest.json`], { stdio: ["ignore", "pipe", "ignore"] }));
} catch {}

const files = readdirSync(dir).filter((f) => /-(vertical|wide)\.mp4$/.test(f)).sort();
for (const f of files) {
  const [, slug, format] = f.match(/^(.*)-(vertical|wide)\.mp4$/);
  const o = plan[slug];
  if (!o) { console.warn("skip (not in plan):", f); continue; }
  gcloud(["storage", "cp", join(dir, f), `gs://${BUCKET}/stories/${slug}/${format}.mp4`, "--content-type=video/mp4", "--quiet"], { stdio: "ignore" });
  const q = o.quotes?.[0] || o.hook1;
  const credit = o.photo ? `Photo of ${o.speaker}: ${o.photo.artist.replace(/^Cr[ée]dit photo\s*:\s*/i, "")}, ${o.photo.license}, via Wikimedia Commons` : "";
  const hashtags = [...new Set([tag(o.speaker), "#AI", "#Leadership", ...o.tag.split(/[·&,]/).filter((w) => w.trim()).slice(0, 2).map(tag)])].join(" ");
  const entry = (manifest.stories[slug] ||= { formats: [] });
  if (!entry.formats.includes(format)) entry.formats.push(format);
  entry.formats.sort((a, b) => (a === "vertical" ? -1 : b === "vertical" ? 1 : 0));
  Object.assign(entry, {
    speaker: o.speaker,
    // The story link is added by the page (raleche.com/story/<slug>), so it is not in the text.
    text: [`${o.speaker}, ${o.role}. ${o.hook1} ${o.hook2}`, o.kind === "quote" ? `"${q}"` : q].join("\n\n"),
    credit,
    hashtags,
    updatedAt: new Date().toISOString(),
  });
  console.log("uploaded", slug, format);
}
manifest.updatedAt = new Date().toISOString();
const tmp = join(mkdtempSync(join(tmpdir(), "story-videos-")), "manifest.json");
writeFileSync(tmp, JSON.stringify(manifest, null, 1));
gcloud(["storage", "cp", tmp, `gs://${BUCKET}/manifest.json`, "--content-type=application/json", "--cache-control=no-cache", "--quiet"], { stdio: "ignore" });
console.log(`manifest: ${Object.keys(manifest.stories).length} stories`);
