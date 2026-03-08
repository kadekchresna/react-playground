import Image from "next/image";
import Link from "next/link";
import tours from "../(data)/tours.json";
import { formatIDR } from "../(lib)/utils";

export const metadata = {
  title: "Bali Day Tour Packages & Airport Transfer | Supernova Bali Airport Pickup & Day Tour",
  description: "Explore Bali airport pickup service and private day tour packages: Ubud, Uluwatu, Lempuyang, Tirta Gangga, Nusa Penida and more. Booking now — pay on the day.",
};

export default function ToursPage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="h2 mb-6">All Tour Packages</h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {tours.map((tour: any) => (
            <Link
              href={`/tours/${tour.slug}`}
              key={tour.slug}
              className="card group hover:shadow-xl transition"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl">
                <Image
                  src={tour.image}
                  alt={tour.title}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-300"
                />
              </div>

              <div className="card-body">
                <span className="inline-block text-xs bg-saffron-100 text-saffron-700 px-2 py-1 rounded-md">
                  {tour.badge}
                </span>

                <h3 className="mt-2 font-semibold text-lg">{tour.title}</h3>
                <p className="text-sm text-[color:var(--text-muted)]">
                  Duration: {tour.duration}
                </p>

                <p className="font-semibold mt-2">
                  {tour.priceFrom && tour.priceFrom > 0 ? `From ${formatIDR(tour.priceFrom)}` : "Pay on the day"}
                </p>

                <ul className="text-xs text-[color:var(--text-muted)] mt-3 space-y-1">
                  {tour.highlights.slice(0, 3).map((h: string, i: number) => (
                    <li key={i}>• {h}</li>
                  ))}
                </ul>

                <div className="mt-4">
                  <span className="btn btn-primary w-full block text-center">
                    View Details
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
