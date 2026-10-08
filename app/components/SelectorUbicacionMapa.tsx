"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Leaflet necesita el DOM del navegador; se carga solo en cliente.
const MapaUbicacion = dynamic(() => import("@/app/components/MapaUbicacion"), {
  ssr: false,
});

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";

export default function SelectorUbicacionMapa({
  onSeleccionar,
  latitud,
  longitud,
}: {
  onSeleccionar: (lat: number, lng: number) => void;
  latitud: number | null;
  longitud: number | null;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centroMapa, setCentroMapa] = useState<[number, number]>([
    -12.0464, -77.0428,
  ]);

  async function buscarDireccion() {
    if (!busqueda.trim()) return;
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(busqueda)}`,
      );
      const resultados = await res.json();
      if (resultados.length === 0) {
        setError(
          "No se encontró esa dirección. Intenta ser más específico, o marca directo en el mapa.",
        );
        return;
      }
      const lat = parseFloat(resultados[0].lat);
      const lng = parseFloat(resultados[0].lon);
      setCentroMapa([lat, lng]);
      onSeleccionar(lat, lng);
    } catch {
      setError("No se pudo buscar en este momento. Marca directo en el mapa.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscarDireccion();
            }
          }}
          placeholder="Buscar dirección (ej: Av. Javier Prado 123, San Isidro)"
          className={inputClass}
        />
        <button
          type="button"
          onClick={buscarDireccion}
          disabled={buscando}
          className="shrink-0 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {buscando ? "..." : "Buscar"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <MapaUbicacion
        seleccionable
        centro={centroMapa}
        zoom={latitud && longitud ? 16 : 6}
        posicionSeleccionada={latitud && longitud ? [latitud, longitud] : null}
        onSeleccionar={onSeleccionar}
        alturaPx={320}
      />

      <p className="text-xs text-slate-500">
        {latitud && longitud
          ? `Ubicación marcada: ${latitud.toFixed(6)}, ${longitud.toFixed(6)}`
          : "Busca la dirección o haz clic directo en el mapa para marcar la ubicación exacta."}
      </p>
    </div>
  );
}
