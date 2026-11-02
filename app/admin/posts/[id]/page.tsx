import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageTitle, Flash } from "@/components/admin/ui";
import { PostEditor } from "@/components/admin/PostEditor";
import { deletePost } from "../../actions";

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [post, categories] = await Promise.all([db.post.findUnique({ where: { id } }), db.category.findMany({ orderBy: { sortOrder: "asc" } })]);
  if (!post) notFound();
  return (
    <div>
      <PageTitle title="Edit post" sub={`${post.views} views · updated ${post.updatedAt.toLocaleString()}`}>
        <Link href={`/story/${post.slug}`} target="_blank" className="term-btn-ghost">View ↗</Link>
        <form action={deletePost}><input type="hidden" name="id" value={post.id} /><button className="term-btn-danger">Delete</button></form>
      </PageTitle>
      {saved && <Flash>Saved.</Flash>}
      <PostEditor post={post} categories={categories} />
    </div>
  );
}
