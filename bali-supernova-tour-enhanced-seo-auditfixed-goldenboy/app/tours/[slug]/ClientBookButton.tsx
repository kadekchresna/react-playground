"use client";
import { useState } from "react";
import BookingModal from "@/app/(components)/BookingModal";

export default function ClientBookButton({ tour }: any) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        Book Now
      </button>

      {open && <BookingModal tour={tour} onClose={() => setOpen(false)} />}
    </>
  );
}
