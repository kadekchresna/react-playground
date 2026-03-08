import Image from "next/image";
import Link from "next/link";
import tours from "../(data)/tours.json";
import { formatIDR } from "../(lib)/utils";

export default function Tours() {
  return (
    <section className="section" id="tours">
      <div className="container">
        <h2 className="h2">Popular Packages</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {tours.map((t) => (
            <article key={t.slug} className="card flex flex-col">
              <div className="relative aspect-[16/10]">
                <Image
                  src={t.image}
                  alt={t.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="card-body flex-1 flex flex-col">
                <div className="text-xs px-2 py-1 rounded-full bg-saffron-100 text-saffron-700 w-max">
                  {t.badge}
                </div>
                <h3 className="font-semibold mt-2">{t.title}</h3>
                <p className="text-sm text-[color:var(--text-muted)] mt-1">
                  Duration: {t.duration}
                </p>
                <ul className="text-sm text-[color:var(--text-muted)] mt-2 list-disc pl-5 space-y-1">
                  {t.highlights.map((h: string) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="font-semibold">
                    {formatIDR(t.priceFrom)}
                  </span>
                  <Link href={`/tours/${t.slug}`} className="btn btn-outline">
                    Details
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/tours" className="btn btn-primary">
            See All Tours
          </Link>
        </div>
      </div>
    </section>
  );
}
