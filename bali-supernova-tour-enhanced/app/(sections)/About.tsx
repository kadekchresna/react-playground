import Image from "next/image";
export default function About() {
  const items = [
    {
      title: "Local Experts",
      desc: "Licensed guides sharing authentic insights.",
    },
    { title: "Flexible Itineraries", desc: "Private trips and small groups." },
    {
      title: "24/7 Support",
      desc: "We’re here before, during, and after your tour.",
    },
    { title: "Best Price", desc: "Transparent pricing with no hidden fees." },
  ];
  return (
    <section className="section bg-sand-50" id="about">
      <div className="container grid lg:grid-cols-2 gap-10 items-center">
        <div className="relative rounded-3xl overflow-hidden shadow-card aspect-[16/10]">
          <Image
            src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=60"
            alt="Turquoise lake and mountains in Bali"
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="h2">
            The Bali Package — Cheap Bali Tour and Holidays Packages
          </h2>
          <p className="muted mt-4">
            Thank you for trusting us to guide your Bali adventure. Each package
            includes local guides, transport during the tour, and a memorable
            local meal.
          </p>
          <ul className="grid sm:grid-cols-2 gap-4 mt-6">
            {items.map((it) => (
              <li key={it.title} className="card p-4">
                <div className="font-semibold">{it.title}</div>
                <p className="text-sm text-[color:var(--text-muted)] mt-1">
                  {it.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
