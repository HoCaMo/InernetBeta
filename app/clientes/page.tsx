import { prisma } from "@/app/lib/db";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    include: {
      ubigeo: true,
      documentos: true,
      telefonos: true,
    },
    orderBy: { fechaRegistro: "desc" },
  });

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Clientes registrados</h1>

      {clientes.length === 0 ? (
        <p>Aún no hay clientes en la base de datos.</p>
      ) : (
        <table
          border={1}
          cellPadding={8}
          style={{ borderCollapse: "collapse", marginTop: "1rem" }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Estado</th>
              <th>Teléfonos</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.idCliente}>
                <td>{cliente.idCliente}</td>
                <td>{cliente.tipoCliente}</td>
                <td>
                  {cliente.nombre} {cliente.apellido ?? ""}
                </td>
                <td>{cliente.correo ?? "—"}</td>
                <td>{cliente.estado}</td>
                <td>
                  {cliente.telefonos.map((t) => t.numero).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
