"use client";

import dynamic from "next/dynamic";
import type { MarcadorMapa } from "@/app/components/MapaUbicacion";

const MapaUbicacion = dynamic(() => import("@/app/components/MapaUbicacion"), {
  ssr: false,
});

export default function MapaClientes({
  marcadores,
}: {
  marcadores: MarcadorMapa[];
}) {
  if (marcadores.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">
        No hay clientes con ubicación registrada todavía.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <MapaUbicacion marcadores={marcadores} alturaPx={500} />
    </div>
  );
}
