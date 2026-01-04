import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-lava-900 text-gray-300 mt-24" id="footer">
      <div className="container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 py-16">
        <div>
          <h3 className="text-white font-bold text-xl">Bali Supernova Tour</h3>
          <p className="mt-3 text-sm">
            Curated day trips and multi-day adventures — guided by locals with a
            personal touch.
          </p>
          <p className="mt-4 text-sm">Open daily 08:00–21:00 WITA</p>
        </div>
        <div>
          <h4 className="text-white font-semibold">Quick Links</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/#destinations">Destinations</Link>
            </li>
            <li>
              <Link href="/#tours">Packages</Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
            <li>
              <Link href="/#about">About</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
            <li>
              <Link href="/privacy-policy">Privacy</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              WhatsApp:{" "}
              <a
                href="https://wa.me/6281234567890"
                target="_blank"
                className="text-brand-300"
              >
                +62 812-3456-7890
              </a>
            </li>
            <li>
              Email:{" "}
              <a href="mailto:hello@balinova.tour" className="text-brand-300">
                hello@balinova.tour
              </a>
            </li>
            <li>Office: Ubud, Gianyar, Bali</li>
            <li>
              <a
                href="https://maps.google.com"
                target="_blank"
                className="text-brand-300"
              >
                View on Google Maps
              </a>
            </li>
          </ul>
          <div className="flex gap-3 mt-4">
            <a
              aria-label="Instagram"
              href="#"
              className="p-2 bg-black/30 rounded-lg"
            >
              IG
            </a>
            <a
              aria-label="TikTok"
              href="#"
              className="p-2 bg-black/30 rounded-lg"
            >
              TT
            </a>
            <a
              aria-label="YouTube"
              href="#"
              className="p-2 bg-black/30 rounded-lg"
            >
              YT
            </a>
          </div>
          <form className="mt-5 flex gap-2">
            <input
              type="email"
              required
              placeholder="Your email"
              className="flex-1 rounded-lg px-3 py-2 text-black"
              aria-label="Email for newsletter"
            />
            <button className="btn btn-primary">Subscribe</button>
          </form>
        </div>
        <div>
          <h4 className="text-white font-semibold">Newsletter</h4>
          <p className="mt-3 text-sm">
            Get Bali travel tips and seasonal deals in your inbox.
          </p>
        </div>
      </div>
      <div className="border-t border-black/40">
        <div className="container py-6 text-center text-xs text-gray-400">
          © {year} Bali Supernova Tour. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
