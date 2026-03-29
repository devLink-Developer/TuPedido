import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchAdminUsers, resetAdminUserPassword } from "../../../shared/services/api";
import type { AuthUser, Role } from "../../../shared/types";
import { roleLabels } from "../../../shared/utils/labels";

const roleOrder: Role[] = ["customer", "merchant", "delivery", "admin"];

function roleCount(users: AuthUser[], role: Role) {
  return users.filter((user) => user.role === role).length;
}

export function UsersPage() {
  const { token } = useAuthSession();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const items = await fetchAdminUsers(token);
      setUsers(items);
      setError(null);
      setActionError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const availableRoles = useMemo(() => roleOrder.filter((role) => users.some((user) => user.role === role)), [users]);
  const filteredUsers = useMemo(
    () => users.filter((user) => (roleFilter ? user.role === roleFilter : true)),
    [roleFilter, users]
  );
  const activeUsers = useMemo(() => users.filter((user) => user.is_active).length, [users]);
  const usersRequiringPasswordChange = useMemo(
    () => users.filter((user) => user.must_change_password).length,
    [users]
  );

  async function handleResetPassword(user: AuthUser) {
    if (!token) return;
    setBusyUserId(user.id);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await resetAdminUserPassword(token, user.id);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                must_change_password: true
              }
            : item
        )
      );
      setActionMessage(
        `Contrasena de ${user.full_name} restablecida a ${response.temporary_password}. El usuario debera cambiarla al ingresar.`
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error ? requestError.message : "No se pudo restablecer la contrasena del usuario"
      );
    } finally {
      setBusyUserId(null);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Usuarios no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Usuarios"
        description="Administra accesos y perfiles del equipo."
        action={
          <button type="button" onClick={() => void load()} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
            Actualizar
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Usuarios totales" value={String(users.length)} description="Base completa de accesos registrados." />
        <StatCard label="Usuarios activos" value={String(activeUsers)} description="Cuentas habilitadas actualmente." />
        <StatCard
          label="Cambio requerido"
          value={String(usersRequiringPasswordChange)}
          description="Usuarios que deben actualizar su contrasena al ingresar."
        />
      </div>

      {actionMessage ? (
        <p className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          {actionMessage}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      <section className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Filtro por rol</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Gestion de usuarios</h2>
            <p className="mt-2 text-sm text-zinc-600">Selecciona un rol para acotar el listado y revisar volumen por tipo de acceso.</p>
          </div>
          {roleFilter ? (
            <button
              type="button"
              onClick={() => setRoleFilter("")}
              className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Limpiar filtro
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRoleFilter("")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              roleFilter === "" ? "bg-brand-500 text-white shadow-float" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            Todos ({users.length})
          </button>
          {availableRoles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                roleFilter === role ? "bg-brand-500 text-white shadow-float" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {roleLabels[role]} ({roleCount(users, role)})
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <article key={user.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Usuario #{user.id}</p>
                <h3 className="mt-2 text-lg font-bold text-ink">{user.full_name}</h3>
                <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{roleLabels[user.role]}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {user.is_active ? "Activo" : "Inactivo"}
                </span>
                {user.must_change_password ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Cambio requerido
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleResetPassword(user)}
                disabled={busyUserId === user.id}
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {busyUserId === user.id ? "Restableciendo..." : "Restablecer contrasena"}
              </button>
              <p className="text-sm text-zinc-500">La contrasena temporal se fija en 12345678.</p>
            </div>
          </article>
        ))}

        {!filteredUsers.length ? (
          <EmptyState
            title="Sin usuarios para ese rol"
            description="No hay cuentas que coincidan con el filtro seleccionado."
            action={
              roleFilter ? (
                <button
                  type="button"
                  onClick={() => setRoleFilter("")}
                  className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Ver todos
                </button>
              ) : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}
