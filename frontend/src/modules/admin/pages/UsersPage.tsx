import { IntegrationPendingCard, PageHeader } from "../../../shared/components";

export function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Usuarios" description="Administra accesos y perfiles del equipo." />
      <IntegrationPendingCard
        title="Gestion avanzada disponible proximamente"
        description="La gestion detallada de usuarios y permisos estara disponible en una proxima actualizacion."
      />
    </div>
  );
}
