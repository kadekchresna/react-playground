"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import gallery from "../(data)/gallery.json"; // ✅ your gallery images

export default function Hero() {
  const heroImages = gallery.slice(0, 6).map((item: any) => item.image); // pick first 6 images
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 4000); // 4s per image

    return () => clearInterval(timer);
  }, [heroImages.length]);

  return (
    <section className="section pt-6" id="hero">
      <div className="container grid md:grid-cols-2 gap-10 items-center">
        {/* Text */}
        <div>
          <h1 className="h1">
            Bali Airport Pickup &{" "}
            <span className="text-saffron-500">Day Tour</span>
            <span className="text-brand-600"> Packages</span>
          </h1>
          <p className="muted mt-4 max-w-xl">
            Airport transfer, private day tours, and island packages — from Ubud highlights to Uluwatu sunset and Lempuyang Heaven Gate. Small or big groups, cars (2–7 seaters) and vans (10–14 seaters).
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="#tours" className="btn btn-accent">
              Explore Tours
            </Link>
            <Link href="/#contact" className="btn btn-outline">
              Contact Us
            </Link>
          </div>
        </div>

        {/* Image Rotator */}
        <div className="relative aspect-[16/10] rounded-3xl overflow-hidden shadow-card">
          {heroImages.map((img, i) => (
            <Image
              key={i}
              src={img}
              alt="Bali Travel"
              fill
              priority={i === 0}
              className={`object-cover absolute inset-0 transition-opacity duration-1000 ${
                i === current ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
