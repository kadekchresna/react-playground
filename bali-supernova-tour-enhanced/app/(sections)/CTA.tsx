import Link from "next/link";
export default function CTA() {
  return (
    <section className="container">
      <div
        className="container text-white rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-4
          bg-[linear-gradient(135deg,#F26D5B,#F4A261,#FFC23E)]"
      >
        <h3 className="text-xl md:text-2xl font-semibold">
          Ready to explore? Book your Bali journey today.
        </h3>
        <Link
          href="#contact"
          className="btn bg-white text-brand hover:bg-coconut-100"
        >
          Book Now
        </Link>
      </div>
    </section>
  );
}
