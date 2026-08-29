"use client";

import { useTransition, useState, useRef } from "react";
import { cambiarPassword } from "./actions";

export default function CambiarPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        await cambiarPassword(formData);
        setMensaje("Contraseña actualizada correctamente.");
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <section
      style={{
        padding: "1rem",
        border: "1px solid #ccc",
        borderRadius: 8,
        maxWidth: 400,
      }}
    >
      <h2>Renovar contraseña</h2>
      {mensaje && <p style={{ color: "green" }}>{mensaje}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form
        ref={formRef}
        action={handleSubmit}
        style={{ display: "grid", gap: "0.5rem" }}
      >
        <input
          name="passwordActual"
          type="password"
          placeholder="Contraseña actual"
          required
        />
        <input
          name="passwordNueva"
          type="password"
          placeholder="Nueva contraseña"
          required
        />
        <input
          name="confirmarPassword"
          type="password"
          placeholder="Confirmar nueva contraseña"
          required
        />
        <button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </section>
  );
}
