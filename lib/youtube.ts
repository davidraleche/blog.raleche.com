/** Stories imported from tts42.com open with "> Watch the original interview: [YouTube](https://www.youtube.com/watch?v=ID)". */
const VIDEO_LINE = /^>[^\n]*\((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})[^)]*\)[^\n]*\n*/m;

/** The YouTube video a story is about, and its body without the link line (the page embeds the player instead). */
export function storyVideo(md: string): { videoId: string | null; body: string } {
  const m = md.match(VIDEO_LINE);
  return m ? { videoId: m[1], body: md.replace(VIDEO_LINE, "") } : { videoId: null, body: md };
}
