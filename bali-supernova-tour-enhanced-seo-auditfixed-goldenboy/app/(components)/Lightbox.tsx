"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  altPrefix?: string; // optional alt text prefix
};

export default function Lightbox({
  images,
  altPrefix = "Gallery image",
}: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const close = () => setOpen(false);
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  // Close on ESC; navigate with arrows
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  // Click outside to close
  const onBackdropClick = (e: React.MouseEvent) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      close();
    }
  };

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const { overflow } = document.body.style;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = overflow;
      };
    }
  }, [open]);

  return (
    <>
      {/* Thumbnails */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((src, i) => (
          <button
            key={src + i}
            onClick={() => openAt(i)}
            className="relative aspect-[16/10] rounded-xl overflow-hidden ring-1 ring-black/5 hover:shadow-md transition"
            aria-label={`Open image ${i + 1}`}
          >
            <Image
              src={src}
              alt={`${altPrefix} ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={onBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <div
            ref={dialogRef}
            className="relative w-full max-w-6xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute -top-10 right-0 md:top-0 md:-right-10 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Prev / Next (hidden on very small screens) */}
            <button
              onClick={prev}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow"
              aria-label="Next image"
            >
              ›
            </button>

            {/* Image container */}
            <div className="relative aspect-[16/10] md:aspect-[3/2] bg-neutral-900 rounded-xl overflow-hidden">
              {/* Spinner while loading */}
              {loading && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}

              <Image
                key={images[index]} // force re-load to show spinner
                src={images[index]}
                alt={`${altPrefix} ${index + 1}`}
                fill
                sizes="90vw"
                className="object-contain"
                onLoadingComplete={() => setLoading(false)}
                onLoadStart={() => setLoading(true)}
                priority
              />
            </div>

            {/* Counter */}
            <div className="mt-3 text-center text-white/80 text-sm">
              {index + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
