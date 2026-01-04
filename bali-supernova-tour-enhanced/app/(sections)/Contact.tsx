"use client";
import { useState } from "react";
import { WA_NUMBER } from "@/app/(components)/BookingModal";

const handleSubmit = (e: any, setSubmitted: any) => {
  e.preventDefault();
  setSubmitted(true);

  const formData = new FormData(e.target);
  const msg = encodeURIComponent(
    `Hello! I'd like to book a tour with these details,

Name: ${formData.get("name")}
Email: ${formData.get("email")}
Phone: ${formData.get("phone")}
Preferred Date: ${formData.get("date")}
Guests: ${formData.get("guests")}
Tour: ${formData.get("package")}
Message: ${formData.get("message")}

Thank you!`
  );

  const url = `https://wa.me/${WA_NUMBER}?text=${msg}`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className="section" id="contact">
      <div className="container">
        <h2 className="h2">Booking / Contact</h2>
        <div className="grid md:grid-cols-2 gap-8 mt-6">
          <form
            className="card p-6 space-y-4"
            onSubmit={(e) => {
              handleSubmit(e, setSubmitted);
            }}
            aria-label="Booking form"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="date">
                  Preferred Date
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" htmlFor="guests">
                  Guests
                </label>
                <input
                  id="guests"
                  name="guests"
                  type="number"
                  min={1}
                  defaultValue={2}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="package">
                  Package
                </label>
                <select
                  id="package"
                  name="package"
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option>Sunrise & Rice Terrace Explorer</option>
                  <option>Uluwatu Sunset & Kecak Dance</option>
                  <option>3-Day North Bali Adventure</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                className="w-full border rounded-lg px-3 py-2"
              ></textarea>
            </div>
            <button className="btn btn-primary w-full">Send Inquiry</button>
            {submitted && (
              <p className="text-green-700 text-sm">
                Thanks! We’ll get back to you shortly.
              </p>
            )}
          </form>
          <div className="space-y-4">
            <div className="card p-6">
              <h3 className="font-semibold">Contact Details</h3>
              <ul className="mt-3 text-sm text-[color:var(--text-muted)] space-y-1">
                <li>WhatsApp: +62 812-3456-7890</li>
                <li>Email: hello@balinova.tour</li>
                <li>Hours: 08:00–21:00 WITA</li>
                <li>Address: Ubud, Gianyar, Bali</li>
              </ul>
              <a
                href={`https://wa.me/${WA_NUMBER}`}
                className="btn btn-outline mt-4"
                target="_blank"
              >
                Chat via WhatsApp
              </a>
            </div>
            <iframe
              className="w-full aspect-video rounded-2xl shadow-card"
              loading="lazy"
              src="https://maps.google.com/maps?q=Ubud%2C%20Bali&t=&z=12&ie=UTF8&iwloc=&output=embed"
            ></iframe>
          </div>
        </div>
      </div>
      {/* <a
        href="#contact"
        className="md:hidden fixed bottom-4 inset-x-4 btn btn-primary text-center"
      >
        Book Now
      </a> */}
    </section>
  );
}
