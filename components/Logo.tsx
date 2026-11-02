export function Logo({ text = "RALECHE", size = "lg" }: { text?: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-9 text-[34px] sm:h-14 sm:w-11 sm:text-[44px]" : "h-7 w-6 text-[22px]";
  return (
    <span className="inline-flex select-none" aria-label={text}>
      {text.split("").map((c, i) => (
        <span
          key={i}
          aria-hidden
          className={`${box} flex items-center justify-center font-display font-extrabold leading-none ${
            i % 2 === 0 ? "bg-ink text-white" : "border-y-[3px] border-ink bg-white text-ink"
          } ${i === text.length - 1 && i % 2 ? "border-r-[3px]" : ""}`}
        >
          {c}
        </span>
      ))}
    </span>
  );
}
