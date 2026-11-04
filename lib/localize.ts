import "server-only";
import { translateMany } from "./translate";
import type { Locale } from "./i18n/messages";

type StrKeys<T> = { [K in keyof T]: T[K] extends string ? K : T[K] extends string | null ? K : never }[keyof T];

/** Translate the given string fields of every row in one batch. */
export async function localizeFields<T extends object, K extends StrKeys<T>>(locale: Locale, rows: T[], fields: K[]): Promise<T[]> {
  if (locale === "en" || !rows.length) return rows;
  const src = rows.flatMap((r) => fields.map((f) => ((r[f] as string | null) ?? "")));
  const out = await translateMany(locale, src);
  return rows.map((r, i) => {
    const copy = { ...r };
    fields.forEach((f, j) => {
      if (r[f]) (copy[f] as unknown) = out[i * fields.length + j];
    });
    return copy;
  });
}

type WithCategory = { title: string; dek: string; category?: { name: string } | null };

/** Title, dek and category name for lists of stories. */
export async function localizePosts<T extends WithCategory>(locale: Locale, posts: T[]): Promise<T[]> {
  if (locale === "en" || !posts.length) return posts;
  const src = posts.flatMap((p) => [p.title, p.dek ?? "", p.category?.name ?? ""]);
  const out = await translateMany(locale, src);
  return posts.map((p, i) => ({
    ...p,
    title: out[i * 3],
    dek: p.dek ? out[i * 3 + 1] : p.dek,
    category: p.category ? { ...p.category, name: out[i * 3 + 2] } : p.category,
  }));
}
