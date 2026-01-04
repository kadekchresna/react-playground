"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import data from "../(data)/testimonials.json";

function useCols() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const set = () => setCols(mq.matches ? 1 : 3);
    set();
    mq.addEventListener("change", set);
    window.addEventListener("orientationchange", set);
    return () => {
      mq.removeEventListener("change", set);
      window.removeEventListener("orientationchange", set);
    };
  }, []);
  return cols;
}

export default function Testimonials() {
  const cols = useCols(); // 1 on mobile, 3 on desktop
  const total = data.length;

  // duplicate so we can loop seamlessly
  const duplicated = [...data, ...data, ...data];
  const BASE = total; // start in middle block
  const [idx, setIdx] = useState(BASE); // logical head index
  const [anim, setAnim] = useState(true);
  const [paused, setPaused] = useState(false);

  const ITEM_PCT = 100 / cols; // shift per step
  const AUTOPLAY_MS = 3500;
  const DURATION_MS = 550;

  const head = (((idx - BASE) % total) + total) % total;

  // re-anchor when layout changes so the same item remains at head
  useEffect(() => {
    setAnim(false);
    setIdx(BASE + head);
    const t = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnim(true))
    );
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);

  // autoplay
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const start = () => {
    stop();
    timerRef.current = setInterval(() => setIdx((i) => i + 1), AUTOPLAY_MS);
  };
  useEffect(() => {
    if (!paused) start();
    return stop;
  }, [paused, cols]);

  // pause when tab hidden
  useEffect(() => {
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // seamless reset when crossing edges of duplicated list
  const onTransitionEnd = () => {
    const MIN = BASE - total;
    const MAX = BASE + total;
    if (idx <= MIN || idx >= MAX) {
      setAnim(false);
      setIdx(BASE + head);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true)));
    }
  };

  return (
    <section className="section" id="testimonials">
      <div className="container">
        <h2 className="h2 text-center">Our Clients Reviews</h2>

        <div
          className="relative mt-8 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            onTransitionEnd={onTransitionEnd}
            className="flex"
            style={{
              transform: `translate3d(-${idx * ITEM_PCT}%,0,0)`,
              transition: anim
                ? `transform ${DURATION_MS}ms ease-in-out`
                : "none",
              willChange: "transform",
            }}
          >
            {duplicated.map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="box-border"
                style={{ minWidth: `${ITEM_PCT}%`, padding: "0 12px" }} // gap between cards
              >
                <figure className="card p-6 flex items-center gap-4 h-full">
                  <Image
                    src={t.avatar}
                    alt={t.name}
                    width={60}
                    height={60}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                  <div>
                    <blockquote className="text-base md:text-lg">
                      “{t.quote}”
                    </blockquote>
                    <div
                      className="flex gap-0.5 text-yellow-400 mt-2 text-sm"
                      aria-label={`${t.rating} star rating`}
                    >
                      {Array.from({ length: t.rating }).map((_, s) => (
                        <span key={s}>★</span>
                      ))}
                    </div>
                    <figcaption className="mt-1 text-sm text-[color:var(--text-muted)]">
                      {t.name} — {t.country}
                    </figcaption>
                  </div>
                </figure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
