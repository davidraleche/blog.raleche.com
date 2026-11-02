import { db } from "@/lib/db";
import { PageTitle } from "@/components/admin/ui";
import { saveCategory, deleteCategory } from "../actions";

export default async function Categories() {
  const cats = await db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { posts: true } } } });
  return (
    <div>
      <PageTitle title="Categories" sub="Sections shown in the site navigation" />
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Order</th><th>Name</th><th>Slug</th><th className="text-right">Posts</th><th></th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}>
                <td colSpan={3}>
                  <form action={saveCategory} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="sortOrder" defaultValue={c.sortOrder} className="term-input" />
                    <input name="name" defaultValue={c.name} className="term-input" />
                    <input name="slug" defaultValue={c.slug} className="term-input" />
                    <button className="term-btn-ghost">Save</button>
                  </form>
                </td>
                <td className="text-right tabular-nums">{c._count.posts}</td>
                <td className="text-right"><form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><button className="text-terminal-down hover:underline">Delete</button></form></td>
              </tr>
            ))}
            <tr>
              <td colSpan={5}>
                <form action={saveCategory} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2">
                  <input name="sortOrder" placeholder="#" className="term-input" />
                  <input name="name" placeholder="New category name" className="term-input" required />
                  <input name="slug" placeholder="slug (auto)" className="term-input" />
                  <button className="term-btn">+ Add</button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
