/** "Buy now at amazon.com" button image linking to the book on Amazon (affiliate link). `label` is the translated alt text. */
export function AmazonButton({ href, label, className = "h-9" }: { href: string; label: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="sponsored nofollow noopener" title={label} className="inline-block transition hover:-translate-y-0.5 hover:brightness-125 active:translate-y-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/buy-on-amazon.png" alt={label} width={377} height={120} loading="lazy" className={`w-auto ${className}`} />
    </a>
  );
}
