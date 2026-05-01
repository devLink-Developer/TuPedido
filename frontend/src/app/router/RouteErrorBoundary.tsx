import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { EmptyState, PageHeader } from "../../shared/components";

function resolveRouteError(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return {
      title: `Error ${error.status}`,
      description: error.statusText || "No pudimos completar la navegacion a esta pantalla."
    };
  }

  if (error instanceof Error) {
    return {
      title: "Ocurrio un error inesperado",
      description: error.message || "La aplicacion fallo al renderizar esta pantalla."
    };
  }

  return {
    title: "Ocurrio un error inesperado",
    description: "La aplicacion fallo al renderizar esta pantalla."
  };
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const { title, description } = resolveRouteError(error);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <PageHeader
        eyebrow="Error"
        title={title}
        description="La pantalla fallo y mostramos una salida segura en lugar del error tecnico crudo."
      />

      <EmptyState
        title="No pudimos mostrar esta vista"
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="app-button px-4 py-3 text-sm">
              Ir al inicio
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="kp-soft-action px-4 py-3 text-sm"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        }
      />

      {import.meta.env.DEV && error instanceof Error ? (
        <pre className="overflow-x-auto border border-[var(--kp-stroke)] bg-[#151515] p-4 text-xs leading-6 text-zinc-100 shadow-sm">
          {error.stack ?? error.message}
        </pre>
      ) : null}
    </div>
  );
}
