import Image from "next/image";
export default function About() {
  const items = [
    {
      title: "Airport Transfer",
      desc: "Reliable Bali airport pickup & drop-off.",
    },
    {
      title: "Daily Tour Packages",
      desc: "Ubud, Uluwatu, East Bali, and more.",
    },
    {
      title: "Small / Big Group",
      desc: "Private trips, family tours, and group handling.",
    },
    {
      title: "Cars & Vans",
      desc: "Normal cars 2–7 seaters • Vans 10–14 seaters.",
    },
  ];
  return (
    <section className="section bg-sand-50" id="about">
      <div className="container grid md:grid-cols-2 gap-10 items-center">
        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-soft">
          <Image
            src="https://prod--bali-goldenboy-tour.s3.us-east-1.amazonaws.com/images/airport.png"
            alt="Bali airport pickup and private day tour driver"
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="h2">
            Bali Airport Pickup Service & Day Tour Package 🔥
          </h2>
          <p className="muted mt-4">
            We provide airport transfers, private day tours, Nusa Penida
            packages, fast boat tickets to Gili & Nusa Penida, and more — with
            friendly local drivers. Booking now, pay on the day.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            {items.map((it) => (
              <div key={it.title} className="card p-5">
                <div className="font-semibold">{it.title}</div>
                <div className="text-sm muted mt-2">{it.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
