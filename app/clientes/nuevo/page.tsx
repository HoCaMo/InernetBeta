import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import ClienteNuevoForm from "./ClienteNuevoForm";

export default async function NuevoClientePage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.rol !== "TRABAJADOR") {
    return (
      <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
        <p className="text-slate-400">
          Solo un Trabajador puede generar clientes nuevos.
        </p>
      </Shell>
    );
  }

  return (
    <Shell nombre={session.user.name ?? ""} rol="TRABAJADOR">
      <h1 className="mb-1 text-2xl font-semibold text-white">
        Generar nuevo cliente
      </h1>
      <p className="mb-8 text-sm text-slate-400">
        Completa todos los campos obligatorios (*). El cliente quedará pendiente
        hasta que un administrador o el jefe lo revise, y también se les
        notificará para definir el derecho de instalación y la activación.
      </p>
      <ClienteNuevoForm />
    </Shell>
  );
}
