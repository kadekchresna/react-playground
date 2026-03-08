"use client";
import { useEffect, useRef, useState } from "react";

export const WA_NUMBER = "6285738401557"; // WhatsApp number

export default function BookingModal({ tour, onClose }: any) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    guests: 1,
    message: "",
  });

  // ✅ Close on outside click
  const handleClickOutside = (e: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // ✅ Close on ESC key
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();

    const text = encodeURIComponent(
      `Hello! I'd like to book a tour with these details,

Name: ${form.name}
Email: ${form.email}
Phone: ${form.phone}
Tour: ${tour.title}
Date: ${form.date}
Guests: ${form.guests}
Extra Notes: ${form.message}

Thank you!`,
    );

    const url = `https://wa.me/${WA_NUMBER}?text=${text}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        className="bg-white dark:bg-lava-900 p-6 rounded-xl shadow-xl w-full max-w-md"
      >
        <h3 className="font-semibold text-lg mb-4">Book {tour.title}</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm mb-1" htmlFor="name">
            Your Name
          </label>
          <input
            name="name"
            required
            placeholder="Your Name"
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleChange}
          />

          <label className="block text-sm mb-1" htmlFor="email">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleChange}
          />

          <label className="block text-sm mb-1" htmlFor="phone">
            Phone / WhatsApp
          </label>
          <input
            name="phone"
            required
            placeholder="Phone / WhatsApp"
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleChange}
          />

          <label className="block text-sm mb-1" htmlFor="date">
            Date
          </label>
          <input
            name="date"
            type="date"
            required
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleChange}
          />
          <label className="block text-sm mb-1" htmlFor="guests">
            Guests
          </label>
          <input
            name="guests"
            type="number"
            min="1"
            defaultValue="1"
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleChange}
          />
          <textarea
            name="message"
            placeholder="Extra notes (optional)"
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleChange}
          />

          <button className="btn btn-primary w-full">Send via WhatsApp</button>
          <button
            type="button"
            className="btn btn-outline w-full"
            onClick={onClose}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
