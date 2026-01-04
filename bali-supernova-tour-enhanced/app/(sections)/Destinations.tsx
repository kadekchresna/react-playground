"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import data from "../(data)/destinations.json";

type T = ReturnType<typeof setTimeout>;
type I = ReturnType<typeof setInterval>;

/** 1 card below 1024px, 3 cards from 1024px+ */
function useCols() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setCols(mq.matches ? 1 : 3);
    onChange();
    mq.addEventListener("change", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
  return cols;
}

export default function Destinations() {
  const cols = useCols(); // 1 or 3
  const total = data.length;

  // Duplicate list so we can scroll seamlessly past ends
  const duplicated = useMemo(() => [...data, ...data, ...data], []);
  const BASE = total; // start in the middle block
  const [idx, setIdx] = useState(BASE);
  const [anim, setAnim] = useState(true);
  const [interacting, setInteracting] = useState(false);

  const AUTOPLAY_MS = 3500;
  const DURATION_MS = 500;

  // spacing (true gap between cards)
  const GAP_PX = cols === 1 ? 16 : 28; // card-to-card
  const EDGE_PX = GAP_PX; // left/right breathing room
  const ITEM_PCT = 100 / cols; // slide width in %

  // Keep the logical head (0..n-1)
  const head = (((idx - BASE) % total) + total) % total;

  // Re-anchor when layout changes so the same head item stays in view
  useEffect(() => {
    setAnim(false);
    setIdx(BASE + head);
    const t = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnim(true))
    );
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);

  // Autoplay
  const autoRef = useRef<I | null>(null);
  const resumeTO = useRef<T | null>(null);
  const stopAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current);
  };
  const startAuto = () => {
    stopAuto();
    autoRef.current = setInterval(() => {
      setAnim(true);
      setIdx((i) => i + 1);
    }, AUTOPLAY_MS);
  };
  useEffect(() => {
    if (!interacting) startAuto();
    return stopAuto;
  }, [interacting, cols]);

  useEffect(() => {
    const h = () => (document.hidden ? stopAuto() : startAuto());
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  const onTransitionEnd = () => {
    const MIN = BASE - total;
    const MAX = BASE + total;
    if (idx <= MIN || idx >= MAX) {
      setAnim(false);
      setIdx(BASE + head);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true)));
    }
  };

  // Indicators
  const goTo = (target: number) => {
    const forward = (target - head + total) % total;
    setAnim(true);
    setIdx(idx + forward);
    stopAuto();
    if (resumeTO.current) clearTimeout(resumeTO.current);
    resumeTO.current = setTimeout(startAuto, AUTOPLAY_MS * 1.25);
  };

  // Swipe
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
    setInteracting(true);
    setAnim(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || !trackRef.current) return;
    deltaX.current = e.touches[0].clientX - startX.current;
    // Move in % so we don't depend on measured widths
    const vw = trackRef.current.getBoundingClientRect().width;
    const pct = (deltaX.current / vw) * 100;
    trackRef.current.style.transform = `translate3d(calc(-${
      idx * ITEM_PCT
    }% + ${pct}%),0,0)`;
  };
  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setAnim(true);
    const THRESH = 40;
    if (Math.abs(deltaX.current) > THRESH) {
      setIdx((i) => i + (deltaX.current < 0 ? 1 : -1));
    } else {
      setIdx((i) => i);
    }
    setInteracting(false);
  };

  return (
    <section className="section" id="destinations">
      <div className="container">
        <h2 className="h2 text-center">Best Destinations in Bali</h2>
        <p className="muted text-center mt-2">
          Handpicked destinations — click a card to see details and available
          tours.
        </p>

        {/* Viewport */}
        <div
          className="relative mt-8 overflow-hidden rounded-2xl"
          onMouseEnter={() => setInteracting(true)}
          onMouseLeave={() => setInteracting(false)}
          style={{ paddingLeft: EDGE_PX, paddingRight: EDGE_PX }}
        >
          {/* Track */}
          <div
            ref={trackRef}
            onTransitionEnd={onTransitionEnd}
            className="flex"
            style={{
              // each slide is ITEM_PCT wide; we translate by index * ITEM_PCT
              transform: `translate3d(-${idx * ITEM_PCT}%,0,0)`,
              transition: anim
                ? `transform ${DURATION_MS}ms ease-in-out`
                : "none",
              willChange: "transform",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {duplicated.map((d, i) => (
              // Slide wrapper: gives real margin between cards via side padding
              <div
                key={`${d.slug}-${i}`}
                className="box-border"
                style={{
                  minWidth: `${ITEM_PCT}%`,
                  paddingLeft: GAP_PX / 2,
                  paddingRight: GAP_PX / 2,
                }}
              >
                <a href="#tours" className="card group h-full block">
                  <div className="relative aspect-[16/10] rounded-2xl overflow-hidden">
                    <Image
                      src={d.image}
                      alt={d.name}
                      fill
                      sizes="(max-width: 1023px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition duration-500"
                      priority={i < cols}
                    />
                  </div>
                  <div className="card-body">
                    <div className="font-semibold text-lg">{d.name}</div>
                    <p className="text-sm text-[color:var(--text-muted)]">
                      {d.teaser}
                    </p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Indicators */}
        <div className="flex justify-center mt-5 gap-2">
          {data.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                i === head
                  ? "bg-brand-600 scale-110"
                  : "bg-gray-400 dark:bg-gray-600"
              }`}
              aria-label={`Go to item ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
