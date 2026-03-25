import { IntegrationPendingCard, PageHeader } from "../../../shared/components";

export function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Usuarios" description="Ruta visible, sin inventar una API que todavía no existe." />
      <IntegrationPendingCard
        title="Gestión de usuarios pendiente"
        description="La pantalla /a/usuarios queda reservada hasta que el backend exponga contratos específicos para alta, edición y auditoría de usuarios."
      />
    </div>
  );
}
