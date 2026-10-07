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
  if (photos.length < 2)
    return (
      <Photo
        eager
        src={photos[0]}
        alt={title}
        className="w-full h-64 sm:h-96 object-cover rounded-3xl"
      />
    );
  const at = (i: number) => photos[((i % photos.length) + photos.length) % photos.length];
  const pick = (src: string) => setIndex(Math.max(0, photos.indexOf(src)));
  return (
    <div>
      {/* Desktop mosaic: selected moment large, next two alongside. */}
      <div className="hidden sm:grid grid-cols-3 gap-2 h-96">
        <button
          type="button"
          onClick={() => pick(at(index))}
          className="col-span-2 h-full rounded-3xl overflow-hidden text-left"
          aria-label={`View photo ${index + 1} of ${photos.length}`}
        >
          <Photo
            eager
            key={at(index)}
            src={at(index)}
            alt={`${title} — photo ${index + 1} of ${photos.length}`}
            className="w-full h-full object-cover"
          />
        </button>
        <div className="grid grid-rows-2 gap-2 h-full">
          {[1, 2].map((off) => (
            <button
              key={off}
              type="button"
              onClick={() => setIndex((index + off) % photos.length)}
              className="rounded-2xl overflow-hidden text-left"
              aria-label={`View photo ${((index + off) % photos.length) + 1} of ${photos.length}`}
            >
              <Photo
                src={at(index + off)}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
      {/* Mobile: single moment with position. */}
      <div className="relative sm:hidden">
        <Photo
          eager
          key={photos[index]}
          src={photos[index]}
          alt={`${title} — photo ${index + 1} of ${photos.length}`}
          className="w-full h-64 object-cover rounded-3xl"
        />
        {photos.length > 1 && (
          <span className="absolute bottom-3 right-3 text-[11px] font-bold bg-ink/70 text-white px-2 py-1 rounded-full">
            {index + 1} / {photos.length}
          </span>
        )}
      </div>
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
