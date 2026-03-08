export const formatIDR = (v: number) => {
  if (!v || v <= 0) return "Pay on the day";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
};
