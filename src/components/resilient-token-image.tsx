import { useEffect, useState } from "react";

type Props = { candidates: string[]; alt: string; className?: string };

export function ResilientTokenImage({ candidates, alt, className }: Props) {
  const [index, setIndex] = useState(0);
  const signature = candidates.join("|");
  useEffect(() => setIndex(0), [signature]);
  const src = candidates[index] ?? candidates[candidates.length - 1];
  if (!src) return <span className={className} aria-label={alt}>?</span>;
  return <img src={src} alt={alt} className={className} onError={() => setIndex((current) => Math.min(current + 1, candidates.length - 1))} referrerPolicy="no-referrer" />;
}
