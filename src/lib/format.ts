export const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

export const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};
