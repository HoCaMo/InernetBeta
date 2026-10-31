"use client";

import { useState, type ReactNode } from "react";

type Pestana = "info" | "planes" | "edicion";

// Muestra la ficha del cliente en tres pestañas. Las tres quedan montadas (solo se oculta
// la que no está activa) para no perder lo que el usuario estaba escribiendo al cambiar de pestaña.
export default function FichaCliente({
  info,
  planes,
  edicion,
  totalPlanes,
}: {
  info: ReactNode;
  planes: ReactNode;
  edicion: ReactNode;
  totalPlanes: number;
}) {
  const [activa, setActiva] = useState<Pestana>("info");

  const pestanas: { id: Pestana; etiqueta: string }[] = [
    { id: "info", etiqueta: "Información" },
    { id: "planes", etiqueta: `Planes (${totalPlanes})` },
    { id: "edicion", etiqueta: "Edición" },
  ];

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-1 border-b border-slate-800">
        {pestanas.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={activa === p.id}
            onClick={() => setActiva(p.id)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition ${
              activa === p.id
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className={activa === "info" ? "pt-6" : "hidden"}>{info}</div>
      <div className={activa === "planes" ? "pt-6" : "hidden"}>{planes}</div>
      <div className={activa === "edicion" ? "pt-6" : "hidden"}>{edicion}</div>
    </div>
  );
}
