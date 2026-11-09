"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { importMemoList } from "@/lib/memos";
import { MEMO_COST } from "@/lib/tokens";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Server actions accept up to 5 MB (next.config); keep a margin for the rest of the form. */
const MAX_FILE = 4.5 * 1024 * 1024;
const FILE_TYPES = ["application/pdf"];

const done = (q: string) => {
  revalidatePath("/admin/memos");
  revalidatePath("/memos");
  redirect(`/admin/memos?${q}`);
};

export async function saveMemo(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) redirect(`/admin/memos?error=title`);
  const price = Number(str(form, "priceTokens") || MEMO_COST);
  if (!Number.isInteger(price) || price < 1) redirect(`/admin/memos?error=price`);
  const data = {
    title,
    summary: str(form, "summary"),
    postId: str(form, "postId") || null,
    priceTokens: price,
    active: form.get("active") === "on",
    sortOrder: Number(str(form, "sortOrder")) || 0,
  };

  const file = form.get("file");
  let fileData = {};
  if (file instanceof File && file.size > 0) {
    if (!FILE_TYPES.includes(file.type)) redirect(`/admin/memos?error=type`);
    if (file.size > MAX_FILE) redirect(`/admin/memos?error=size`);
    fileData = { fileName: file.name, fileType: file.type, fileSize: file.size, fileData: Buffer.from(await file.arrayBuffer()) };
  }

  if (id) {
    await db.memo.update({ where: { id }, data: { ...data, ...fileData } });
  } else {
    let slug = slugify(title) || "memo";
    if (await db.memo.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${Date.now().toString(36)}`;
    await db.memo.create({ data: { ...data, ...fileData, slug } });
  }
  done(`saved=${id || "new"}`);
}

export async function removeMemoFile(form: FormData) {
  await requireAdmin();
  await db.memo.update({ where: { id: str(form, "id") }, data: { fileName: null, fileType: null, fileSize: null, fileData: null } });
  done("saved=file");
}

export async function deleteMemo(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  // Never delete a memo someone paid for: hide it instead.
  if (await db.memoPurchase.count({ where: { memoId: id } })) {
    await db.memo.update({ where: { id }, data: { active: false } });
    done("error=bought");
  }
  await db.memo.delete({ where: { id } });
  done("deleted=1");
}

export async function importMemos() {
  await requireAdmin();
  const r = await importMemoList().catch(() => null);
  if (!r) done("error=import");
  done(`imported=${r!.created}`);
}
