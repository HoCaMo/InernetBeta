import Link from "next/link";
import NotificationBell from "./NotificationBell";
import LogoutButton from "./LogoutButton";

const NAV_POR_ROL: Record<string, { href: string; label: string }[]> = {
  JEFE: [
    { href: "/jefe", label: "Panel" },
    { href: "/solicitudes", label: "Solicitudes" },
    { href: "/ubigeo/gestion", label: "Ubigeos" },
    { href: "/perfil", label: "Perfil" },
  ],
  ADMINISTRADOR: [
    { href: "/administrador", label: "Panel" },
    { href: "/solicitudes", label: "Solicitudes" },
    { href: "/clientes/gestion", label: "Clientes" },
    { href: "/perfil", label: "Perfil" },
  ],
  TRABAJADOR: [
    { href: "/trabajador", label: "Panel" },
    { href: "/clientes/nuevo", label: "Nuevo cliente" },
    { href: "/solicitudes", label: "Solicitudes" },
    { href: "/perfil", label: "Perfil" },
  ],
};

export default function Shell({
  nombre,
  rol,
  children,
}: {
  nombre: string;
  rol: "JEFE" | "ADMINISTRADOR" | "TRABAJADOR";
  children: React.ReactNode;
}) {
  const nav = NAV_POR_ROL[rol] ?? [];

  return (
    <div className="min-h-full bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500">
                Internet Fibra
              </p>
              <p className="text-sm text-slate-400">
                {nombre} · <span className="text-slate-500">{rol}</span>
              </p>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
