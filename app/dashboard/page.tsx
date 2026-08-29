import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.rol === "JEFE") redirect("/jefe");
  if (session.user.rol === "ADMINISTRADOR") redirect("/administrador");
  redirect("/trabajador");
}
