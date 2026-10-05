"use client";
import { useState } from "react";
export default function Photo({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`bg-mist text-pine flex items-center justify-center ${className}`}
      >
        <span className="text-xs font-bold p-4">Photo unavailable</span>
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
export function Gallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const [index, setIndex] = useState(0);
  return (
    <div>
      <Photo
        eager
        key={photos[index]}
        src={photos[index]}
        alt={`${title} — photo ${index + 1}`}
        className="w-full h-64 sm:h-96 object-cover rounded-3xl border border-line"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {photos.map((p, i) => (
          <button
            type="button"
            key={p}
            aria-label={`View photo ${i + 1}`}
            aria-pressed={index === i}
            onClick={() => setIndex(i)}
            className={`w-20 sm:w-28 rounded-xl overflow-hidden ${index === i ? "ring-2 ring-pine ring-offset-2" : ""}`}
          >
            <Photo
              src={p}
              alt=""
              className="w-full h-16 sm:h-20 object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
