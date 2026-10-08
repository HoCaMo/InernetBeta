"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Arregla el ícono por defecto de Leaflet (problema conocido con bundlers como Next.js)
// @ts-expect-error - acceso interno necesario para el fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type MarcadorMapa = {
  id: number | string;
  lat: number;
  lng: number;
  color?: string;
  popup?: string;
};

export default function MapaUbicacion({
  marcadores = [],
  centro = [-12.0464, -77.0428], // Lima, Perú
  zoom = 6,
  seleccionable = false,
  posicionSeleccionada = null,
  onSeleccionar,
  alturaPx = 400,
}: {
  marcadores?: MarcadorMapa[];
  centro?: [number, number];
  zoom?: number;
  seleccionable?: boolean;
  posicionSeleccionada?: [number, number] | null;
  onSeleccionar?: (lat: number, lng: number) => void;
  alturaPx?: number;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorSeleccionadoRef = useRef<L.Marker | null>(null);
  const capasFijasRef = useRef<L.Marker[]>([]);

  // Inicializa el mapa una sola vez
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const mapa = L.map(contenedorRef.current).setView(centro, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);
    mapaRef.current = mapa;

    if (seleccionable) {
      mapa.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (marcadorSeleccionadoRef.current) {
          marcadorSeleccionadoRef.current.setLatLng([lat, lng]);
        } else {
          marcadorSeleccionadoRef.current = L.marker([lat, lng]).addTo(mapa);
        }
        onSeleccionar?.(lat, lng);
      });
    }

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modo visor: pinta/actualiza los marcadores fijos
  useEffect(() => {
    if (!mapaRef.current || seleccionable) return;

    capasFijasRef.current.forEach((m) => m.remove());
    capasFijasRef.current = [];

    marcadores.forEach((m) => {
      const icono = m.color
        ? L.divIcon({
            className: "",
            html: `<div style="background:${m.color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.6)"></div>`,
            iconSize: [14, 14],
          })
        : undefined;
      const marker = L.marker(
        [m.lat, m.lng],
        icono ? { icon: icono } : undefined,
      ).addTo(mapaRef.current!);
      if (m.popup) marker.bindPopup(m.popup);
      capasFijasRef.current.push(marker);
    });

    if (marcadores.length > 0) {
      const grupo = L.featureGroup(capasFijasRef.current);
      mapaRef.current.fitBounds(grupo.getBounds().pad(0.2));
    }
  }, [marcadores, seleccionable]);

  // Modo selector: si ya hay una posición guardada (ej. al editar), la muestra
  useEffect(() => {
    if (!mapaRef.current || !seleccionable || !posicionSeleccionada) return;
    const [lat, lng] = posicionSeleccionada;
    if (marcadorSeleccionadoRef.current) {
      marcadorSeleccionadoRef.current.setLatLng([lat, lng]);
    } else {
      marcadorSeleccionadoRef.current = L.marker([lat, lng]).addTo(
        mapaRef.current,
      );
    }
    mapaRef.current.setView([lat, lng], 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicionSeleccionada, seleccionable]);

  return (
    <div
      ref={contenedorRef}
      style={{ height: alturaPx, width: "100%", borderRadius: 12 }}
      className="overflow-hidden border border-slate-700"
    />
  );
}
