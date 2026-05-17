import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Bike, CheckCircle2, Circle, Layers3, MapPin, PackagePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, LoadingCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchMerchantStore } from "../../../shared/services/api";
import type { MerchantStore } from "../../../shared/types";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { getMerchantGuidedSetupStatus } from "../utils/guidedSetup";

type GuidedStep = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  complete: boolean;
  icon: typeof MapPin;
};

function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={[
        "inline-flex min-h-[30px] items-center gap-1.5 rounded border px-2.5 text-xs font-semibold",
        complete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
      ].join(" ")}
    >
      {complete ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {complete ? "Completo" : "Pendiente"}
    </span>
  );
}

function StepCard({ step, index }: { step: GuidedStep; index: number }) {
  const Icon = step.icon;

  return (
    <article className="app-panel rounded p-3">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
        <span
          className={[
            "inline-flex h-11 w-11 items-center justify-center rounded border text-sm font-bold",
            step.complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[var(--kp-stroke)] bg-white text-[var(--kp-accent)]"
          ].join(" ")}
        >
          {step.complete ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 text-[var(--kp-accent)]" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Paso {index + 1}</p>
            <StatusBadge complete={step.complete} />
          </div>
          <h2 className="mt-2 text-lg font-bold text-ink">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">{step.description}</p>
        </div>
        <Link
          to={step.href}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          {step.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function DetailRow({ ready, children }: { ready: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm leading-6 text-zinc-600">
      {ready ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      )}
      <span>{children}</span>
    </li>
  );
}

export function GuidedSetupPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMerchantStore(token)
      .then((storeResult) => {
        if (!cancelled) {
          setStore(storeResult);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la guia inicial");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const setupStatus = useMemo(() => (store ? getMerchantGuidedSetupStatus(store) : null), [store]);
  const completedBaseSteps = setupStatus
    ? [setupStatus.addressCoverageReady, setupStatus.taxonomyReady, setupStatus.productReady].filter(Boolean).length
    : 0;

  if (loading) return <LoadingCard label="Cargando guia inicial..." />;
  if (error || !store || !setupStatus) {
    return <EmptyState title="Guia inicial no disponible" description={error ?? "No se pudo cargar el comercio."} />;
  }

  const steps: GuidedStep[] = [
    {
      key: "coverage",
      title: "Direccion y alcance",
      description:
        "Carga la direccion exacta del local y guarda al menos un poligono valido para definir desde donde aceptas pedidos.",
      href: "/m/alcance",
      cta: "Configurar direccion y alcance",
      complete: setupStatus.addressCoverageReady,
      icon: MapPin
    },
    {
      key: "taxonomy",
      title: "Taxonomia",
      description:
        "Crea la primera categoria de producto. Las subcategorias son opcionales y puedes sumarlas cuando ordenen mejor el catalogo.",
      href: "/m/productos",
      cta: "Crear taxonomia",
      complete: setupStatus.taxonomyReady,
      icon: Layers3
    },
    {
      key: "product",
      title: "Primer articulo",
      description:
        "Carga al menos un articulo activo para que el comercio tenga oferta visible cuando habilites la venta.",
      href: "/m/productos",
      cta: "Agregar articulo",
      complete: setupStatus.productReady,
      icon: PackagePlus
    }
  ];

  return (
    <div className="space-y-3">
      <MerchantPageBar
        eyebrow="Guia inicial"
        title="Configura tu comercio"
        description="Completa lo minimo para dejar el panel listo antes de operar."
        stats={[
          { label: "Base", value: `${completedBaseSteps}/3`, tone: setupStatus.baseComplete ? "success" : "warning" },
          { label: "Direccion", value: setupStatus.addressReady ? "Lista" : "Pendiente", tone: setupStatus.addressReady ? "success" : "warning" },
          { label: "Catalogo", value: setupStatus.productReady ? "Con articulo" : "Pendiente", tone: setupStatus.productReady ? "success" : "warning" },
          { label: "Envio", value: setupStatus.deliveryReady ? "Habilitable" : "Incompleto", tone: setupStatus.deliveryReady ? "success" : "neutral" }
        ]}
      />

      <section className="space-y-3" aria-label="Pasos de configuracion inicial">
        {steps.map((step, index) => (
          <StepCard key={step.key} step={step} index={index} />
        ))}
      </section>

      <section className="app-panel rounded p-3">
        <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded border border-[var(--kp-stroke)] bg-white text-[var(--kp-accent)]">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Envio</p>
              <span
                className={[
                  "inline-flex min-h-[30px] items-center rounded border px-2.5 text-xs font-semibold",
                  setupStatus.deliveryReady
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-zinc-100 text-zinc-600"
                ].join(" ")}
              >
                {setupStatus.deliveryReady ? "Habilitable" : "No habilitable"}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-ink">Requisitos para habilitar delivery</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-600">
              Puedes completar la guia base sin repartidores. Para activar envio, el comercio necesita direccion, zona de envio y al menos un repartidor activo.
            </p>
            <ul className="mt-3 grid gap-1.5 md:grid-cols-3">
              <DetailRow ready={setupStatus.addressReady}>Direccion exacta configurada.</DetailRow>
              <DetailRow ready={setupStatus.deliveryCoverageReady}>Zona de envio con 3 vertices o mas.</DetailRow>
              <DetailRow ready={setupStatus.activeRiderReady}>Al menos un repartidor activo.</DetailRow>
            </ul>
          </div>
          <Link
            to="/m/riders"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded border border-[var(--kp-stroke)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-brand-200 hover:text-ink"
          >
            Gestionar repartidores
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
