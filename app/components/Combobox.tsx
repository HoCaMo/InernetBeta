"use client";

import { useState, useRef, useEffect } from "react";

export default function Combobox({
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState(value);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setTexto(value), [value]);

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto(value); // si no seleccionó nada de la lista, vuelve al último valor válido
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [value]);

  const filtradas = options
    .filter((o) => o.toLowerCase().includes(texto.toLowerCase()))
    .slice(0, 50);

  return (
    <div className="relative" ref={ref}>
      {/* Este input oculto es el que realmente viaja en el formulario */}
      <input type="hidden" name={name} value={value} />

      <input
        type="text"
        disabled={disabled}
        value={texto}
        placeholder={disabled ? "—" : (placeholder ?? "Escribe para buscar...")}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          if (e.target.value === "") onChange("");
        }}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {abierto && !disabled && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {filtradas.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Sin resultados</p>
          ) : (
            <ul>
              {filtradas.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o);
                      setTexto(o);
                      setAbierto(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-amber-500/10 hover:text-amber-400"
                  >
                    {o}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
