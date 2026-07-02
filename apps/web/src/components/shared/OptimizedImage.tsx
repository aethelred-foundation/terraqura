import Image, { type ImageProps } from "next/image";
import { IMAGES, type ImageKey } from "@/lib/image-manifest";
import { reportClientError } from "@/lib/errors";

type OptimizedImageProps = Omit<ImageProps, "src" | "alt" | "placeholder"> & {
  src: ImageKey;
  alt: string;
  /**
   * Set to `priority` for above-the-fold images (LCP candidates). Defaults to
   * lazy loading for everything below the fold.
   */
  priority?: boolean;
};

/**
 * <OptimizedImage src="proof-of-physics" alt="..." />
 *
 * Wraps next/image with our pre-generated WebP set:
 * - blurDataURL placeholder for instant LQIP
 * - widest pre-generated variant as the canonical src (next/image picks the
 *   right responsive size from there)
 * - aspect ratio set so layout never shifts
 *
 * Usage with `fill`:
 *   <div className="relative aspect-[16/9]"><OptimizedImage src="..." alt="..." fill /></div>
 *
 * Usage as a sized image:
 *   <OptimizedImage src="..." alt="..." width={1200} height={750} />
 */
export function OptimizedImage({
  src,
  alt,
  priority = false,
  ...rest
}: OptimizedImageProps) {
  const entry = IMAGES[src];
  if (!entry) {
    if (typeof window !== "undefined") {
      void reportClientError(new Error("Unknown optimized image key"), {
        source: "optimized-image",
        imageKey: String(src),
      });
    }
    return null;
  }
  const widest = entry.sources[entry.sources.length - 1];
  const widestSrc = widest?.webp ?? "";
  return (
    <Image
      src={widestSrc}
      alt={alt}
      placeholder="blur"
      blurDataURL={entry.blurDataURL}
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      {...rest}
    />
  );
}
