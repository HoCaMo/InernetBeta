"use client";

import { useEffect, useState, useRef } from "react";

type Notificacion = {
  idNotificacion: number;
  mensaje: string;
  leida: boolean;
  fecha: string;
};

export default function NotificationBell() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  async function cargar() {
    try {
      const res = await fetch("/api/notificaciones");
      if (!res.ok) return;
      const data = await res.json();
      setNotificaciones(data.notificaciones);
      setNoLeidas(data.noLeidas);
    } catch {
      // silencioso: no interrumpir la UI si falla una consulta de sondeo
    }
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 8000); // cada 8 segundos, sin recargar la página
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  async function marcarTodasLeidas() {
    await fetch("/api/notificaciones", {
      method: "POST",
      body: JSON.stringify({ marcarTodas: true }),
    });
    cargar();
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-amber-400"
        aria-label="Notificaciones"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-slate-950">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <span className="text-sm font-medium text-white">
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodasLeidas}
                className="text-xs text-amber-500 hover:text-amber-400"
              >
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notificaciones.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Sin notificaciones.
              </p>
            )}
            {notificaciones.map((n) => (
              <div
                key={n.idNotificacion}
                className={`border-b border-slate-800/60 px-4 py-3 text-sm ${
                  n.leida ? "text-slate-500" : "text-slate-200"
                }`}
              >
                <p>{n.mensaje}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-600">
                  {new Date(n.fecha).toLocaleString("es-PE")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
