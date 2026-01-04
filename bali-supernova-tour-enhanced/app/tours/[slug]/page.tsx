import Image from "next/image";
import tours from "../../(data)/tours.json";
import { formatIDR } from "../../(lib)/utils";
import ClientBookButton from "./ClientBookButton"; // ✅ new component

export async function generateStaticParams() {
  return tours.map((t) => ({ slug: t.slug }));
}

export default function TourDetail({ params }: { params: { slug: string } }) {
  const tour = tours.find((t) => t.slug === params.slug);
  if (!tour) return <div className="container section">Tour not found.</div>;

  return (
    <div className="section">
      <div className="container grid md:grid-cols-2 gap-8">
        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden shadow-card">
          <Image
            src={tour.image}
            alt={tour.title}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="h2">{tour.title}</h1>
          <div className="mt-2 text-saffron-700 text-sm">{tour.badge}</div>
          <p className="mt-2">Duration: {tour.duration}</p>
          <p className="mt-2 font-semibold">From {formatIDR(tour.priceFrom)}</p>

          <h3 className="font-semibold mt-6">Highlights</h3>
          <ul className="list-disc pl-5 text-[color:var(--text-muted)] mt-2 space-y-1">
            {tour.highlights.map((h: string) => (
              <li key={h}>{h}</li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <ClientBookButton tour={tour} /> {/* ✅ Client logic here */}
          </div>
        </div>
      </div>
    </div>
  );
}
