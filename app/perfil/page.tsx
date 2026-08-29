import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import CambiarPasswordForm from "./CambiarPasswordForm";
import LogoutButton from "@/app/components/LogoutButton";
export default async function PerfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const notificaciones = await prisma.notificacion.findMany({
    where: { idUsuarioDestino: session.user.idUsuario },
    orderBy: { fecha: "desc" },
    take: 20,
  });

  return (
    <main style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Mi perfil</h1>
      <p>
        {session.user.name} — {session.user.rol} <LogoutButton />
      </p>

      <CambiarPasswordForm />

      <section style={{ marginTop: "2rem" }}>
        <h2>Notificaciones</h2>
        {notificaciones.length === 0 && <p>No tienes notificaciones.</p>}
        <ul>
          {notificaciones.map((n) => (
            <li key={n.idNotificacion} style={{ marginBottom: "0.5rem" }}>
              <small>{new Date(n.fecha).toLocaleString("es-PE")}</small>
              <br />
              {n.mensaje}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
