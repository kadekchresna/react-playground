import Image from "next/image";
import type { Metadata } from "next";
import tours from "../../(data)/tours.json";
import { formatIDR } from "../../(lib)/utils";
import { SITE_NAME, SITE_URL } from "../../(lib)/site";
import ClientBookButton from "./ClientBookButton";

export async function generateStaticParams() {
  return tours.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const tour = tours.find((t: any) => t.slug === params.slug);
  if (!tour) {
    return {
      title: `Tour not found`,
      robots: { index: false, follow: false },
    };
  }

  const title = tour.title;
  const description =
    (tour.highlights?.slice?.(0, 3)?.join(" • ") ||
      "Private Bali day tour package with airport transfer options.") +
    " Booking now — pay on the day.";

  return {
    title,
    description,
    alternates: { canonical: `/tours/${tour.slug}/` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tours/${tour.slug}/`,
      siteName: SITE_NAME,
      images: [
        {
          url: tour.image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [tour.image],
    },
  };
}

function buildTourJsonLd(tour: any) {
  const url = `${SITE_URL}/tours/${tour.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: tour.title,
    url,
    areaServed: "Bali",
    provider: {
      "@type": "LocalBusiness",
      name: SITE_NAME,
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceCurrency: "IDR",
      price: tour.priceFrom && tour.priceFrom > 0 ? String(tour.priceFrom) : undefined,
    },
  };
}

export default function TourDetail({ params }: { params: { slug: string } }) {
  const tour = tours.find((t: any) => t.slug === params.slug);
  if (!tour) return <div className="container section">Tour not found.</div>;

  const jsonLd = buildTourJsonLd(tour);

  return (
    <div className="section">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container grid md:grid-cols-2 gap-8">
        <div className="relative aspect-[16/10] rounded-3xl overflow-hidden shadow-soft">
          <Image src={tour.image} alt={tour.title} fill className="object-cover" />
        </div>
        <div>
          <h1 className="h2">{tour.title}</h1>
          <div className="mt-2 text-saffron-700 text-sm">{tour.badge}</div>
          <p className="mt-2">Duration: {tour.duration}</p>

          {tour.priceFrom && tour.priceFrom > 0 ? (
            <p className="mt-2 font-semibold">From {formatIDR(tour.priceFrom)}</p>
          ) : (
            <p className="mt-2 font-semibold">Booking now — pay on the day</p>
          )}

          <h3 className="font-semibold mt-6">Highlights</h3>

          <ul className="list-disc pl-5 text-[color:var(--text-muted)] mt-2 space-y-1">
            {tour.highlights.map((h: string) => (
              <li key={h}>{h}</li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <ClientBookButton tour={tour} />
          </div>
        </div>
      </div>
    </div>
  );
}
