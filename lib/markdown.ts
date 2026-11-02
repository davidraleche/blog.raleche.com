import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(md: string) {
  // Strip raw <script>/<iframe>/event handlers; content is authored by admins or imported from our own site.
  const html = marked.parse(md || "", { async: false }) as string;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "");
}
