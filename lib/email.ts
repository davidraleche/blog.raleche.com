import "server-only";

export type Attachment = { filename: string; content: Uint8Array };

export async function sendEmail(to: string, subject: string, html: string, attachments: Attachment[] = []) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${to} subject=${subject}${attachments.length ? ` attachments=${attachments.map((a) => a.filename).join(",")}` : ""}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Raleche <newsletter@raleche.com>",
      to,
      subject,
      html,
      ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) } : {}),
    }),
  });
  return res.ok;
}
