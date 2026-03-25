const categories = ["Despensas", "Farmacias", "Kioscos", "Parrillas", "Pizzerias", "Mascotas"];

export function CategoryGrid() {
  return (
    <section className="rounded-[32px] bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Explora categorias</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <div key={category} className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm font-semibold text-zinc-700">
            {category}
          </div>
        ))}
      </div>
    </section>
  );
}
