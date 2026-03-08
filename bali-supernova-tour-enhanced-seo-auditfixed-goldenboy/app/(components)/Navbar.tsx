"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/#destinations", label: "Destinations" },
  { href: "/tours", label: "Tours" },
  { href: "/#gallery", label: "Gallery" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/#faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b border-gray-200 bg-[color:var(--bg-surface)]/80">
      <div className="container flex items-center justify-between h-16">
        <Link href="/" className="font-extrabold text-lg">
          <span className="text-saffron-500">Supernova</span> Vacation
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand-700">
              {l.label}
            </Link>
          ))}
          {/* <ThemeToggle /> */}
          <Link href="/#contact" className="btn btn-primary ml-2">
            Book Now
          </Link>
        </nav>
        <button
          aria-label="Toggle menu"
          className="md:hidden p-2 rounded-lg border"
          onClick={() => setOpen((b) => !b)}
        >
          ☰
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t bg-[color:var(--bg-surface)]">
          <div className="container py-2 flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen((b) => !b)}
                className="py-2"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              className="btn btn-primary"
              onClick={() => setOpen((b) => !b)}
            >
              Book Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
