import { db } from "@/lib/db";
import { PageTitle } from "@/components/admin/ui";
import { PostEditor } from "@/components/admin/PostEditor";

export default async function NewPost() {
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return (<div><PageTitle title="New post" /><PostEditor categories={categories} /></div>);
}
