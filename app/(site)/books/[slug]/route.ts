/** A book's share link (raleche.com/books/<slug>): opens the book on the Books page, keeping ?source= and ?by= for tracking. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // A relative Location, so the redirect stays on raleche.com behind the proxy.
  return new Response(null, { status: 307, headers: { Location: `/books${new URL(req.url).search}#${encodeURIComponent(slug)}` } });
}
