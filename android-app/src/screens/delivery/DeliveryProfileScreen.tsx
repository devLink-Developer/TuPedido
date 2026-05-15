import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { fetchDeliveryMe } from "../../services/api";
import { PRIVACY_POLICY_URL } from "../../config/legal";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, radii, shadow, spacing } from "../../theme";
import type { DeliveryProfile } from "../../types/api";
import type { DeliveryTabsParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatDateTime } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryProfile">;
type IconName = ComponentProps<typeof Ionicons>["name"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "R";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function vehicleLabel(value: string | null | undefined) {
  if (!value) return "No informado";
  if (value === "bicycle") return "Bicicleta";
  if (value === "motorcycle") return "Moto";
  if (value === "car") return "Auto";
  return value;
}

function ratingLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Sin calificación";
  return value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function DeliveryProfileScreen(_props: Props) {
  const { token, logout, deleteAccount } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchDeliveryMe(token));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No pudimos cargar tu perfil"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const profileInitials = useMemo(() => initials(profile?.full_name ?? ""), [profile?.full_name]);

  async function handleLogout() {
    await stopDeliveryLocationTracking();
    await logout();
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await stopDeliveryLocationTracking();
      await deleteAccount();
    } catch (deleteError) {
      showError("No pudimos eliminar la cuenta", friendlyErrorMessage(deleteError));
    } finally {
      setDeletingAccount(false);
    }
  }

  function requestAccountDeletion() {
    showDialog({
      title: "Eliminar cuenta",
      message: "Se cerrará tu sesión y se quitarán tus datos de la app cuando corresponda.",
      variant: "danger",
      actions: [
        { label: "Cancelar", variant: "ghost" },
        { label: "Eliminar", variant: "danger", onPress: () => void handleDeleteAccount() }
      ]
    });
  }

  if (!profile && loading) return <StateMessage title="Cargando perfil" loading />;

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <SectionHeader size="large" title="Perfil" description={error ?? "Tus datos de trabajo y seguridad."} />
      {profile ? (
        <View style={styles.content}>
          <Card style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileInitials}</Text>
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.name} numberOfLines={2}>{profile.full_name}</Text>
                <Text style={styles.email} numberOfLines={1}>{profile.email}</Text>
                <View style={styles.availabilityPill}>
                  <Ionicons name={profile.availability === "idle" ? "radio-button-on" : "radio-button-off"} size={15} color={profile.availability === "idle" ? colors.success : colors.warning} />
                  <Text style={styles.availabilityText}>{labelForStatus(profile.availability)}</Text>
                </View>
              </View>
            </View>
          </Card>

          <View style={styles.summaryGrid}>
            <MetricCard icon="checkmark-done-outline" label="Entregas" value={String(profile.completed_deliveries)} tone="primary" />
            <MetricCard icon="star-outline" label="Calificación" value={ratingLabel(profile.rating)} tone="warning" />
            <MetricCard icon="bicycle-outline" label="Vehículo" value={vehicleLabel(profile.vehicle_type)} tone="neutral" />
            <MetricCard icon="notifications-outline" label="Avisos" value={profile.push_enabled ? "Activos" : "Pausados"} tone={profile.push_enabled ? "success" : "neutral"} />
          </View>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contacto</Text>
            <InfoRow icon="call-outline" label="Teléfono" value={profile.phone ?? "No informado"} />
            <InfoRow icon="alert-circle-outline" label="Emergencia" value={[profile.emergency_contact_name, profile.emergency_contact_phone].filter(Boolean).join(" · ") || "No informado"} />
            <InfoRow icon="id-card-outline" label="DNI" value={profile.dni_number ?? "No informado"} />
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Trabajo</Text>
            <InfoRow icon="storefront-outline" label="Comercio" value={profile.store_name ?? "Sin comercio fijo"} />
            <InfoRow icon="map-outline" label="Zona" value={profile.current_zone_id ? `Zona ${profile.current_zone_id}` : "Sin zona activa"} />
            <InfoRow icon="location-outline" label="Última ubicación" value={profile.last_location_at ? formatDateTime(profile.last_location_at) : "Aún no compartida"} />
            {profile.vehicle_plate ? <InfoRow icon="pricetag-outline" label="Patente" value={profile.vehicle_plate} /> : null}
          </Card>

          <Card style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Cuenta</Text>
            <AppButton title="Política de privacidad" icon="shield-checkmark-outline" onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} variant="ghost" fullWidth />
            <AppButton title="Cerrar sesión" icon="log-out-outline" onPress={() => void handleLogout()} variant="ghost" fullWidth />
            <AppButton title="Eliminar cuenta" icon="trash-outline" onPress={requestAccountDeletion} loading={deletingAccount} variant="danger" fullWidth />
          </Card>
        </View>
      ) : (
        <StateMessage title="Perfil no disponible" description={error ?? undefined} actionLabel="Reintentar" onAction={() => void load()} />
      )}
    </Screen>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: "primary" | "success" | "warning" | "neutral" }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, styles[`${tone}Icon`]]}>
        <Ionicons name={icon} size={18} color={tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "neutral" ? colors.text : colors.primary} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  hero: {
    gap: spacing.md,
    borderRadius: radii.lg
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900"
  },
  heroCopy: {
    flex: 1,
    minWidth: 0
  },
  name: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  email: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 2
  },
  availabilityPill: {
    minHeight: 32,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  availabilityText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    width: "48.7%",
    minHeight: 112,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.soft
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  primaryIcon: {
    backgroundColor: colors.primarySoft
  },
  successIcon: {
    backgroundColor: colors.successSoft
  },
  warningIcon: {
    backgroundColor: colors.warningSoft
  },
  neutralIcon: {
    backgroundColor: colors.surfaceAlt
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  sectionCard: {
    gap: spacing.md,
    borderRadius: radii.lg
  },
  actionsCard: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderColor: colors.borderStrong
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  infoRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  infoCopy: {
    flex: 1,
    minWidth: 0
  },
  infoLabel: {
    color: colors.subtleText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 1
  }
});
