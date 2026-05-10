import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { fetchDeliveryMe } from "../../services/api";
import { useAuth } from "../../state/AuthContext";
import { colors, spacing } from "../../theme";
import type { DeliveryProfile } from "../../types/api";
import type { DeliveryTabsParamList } from "../../navigation/types";
import { labelForStatus } from "../../utils/labels";
import { stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryProfile">;

export function DeliveryProfileScreen(_props: Props) {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setProfile(await fetchDeliveryMe(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleLogout() {
    await stopDeliveryLocationTracking();
    await logout();
  }

  if (!profile && loading) return <StateMessage title="Cargando perfil" loading />;

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <SectionHeader size="large" title="Perfil repartidor" description={profile?.email ?? "Datos de repartidor"} />
      {profile ? (
        <Card style={styles.card}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.meta}>Teléfono: {profile.phone ?? "No informado"}</Text>
          <Text style={styles.meta}>Vehículo: {profile.vehicle_type ?? "No informado"}</Text>
          <Text style={styles.meta}>Estado: {labelForStatus(profile.availability)}</Text>
          <Text style={styles.meta}>Zona: {profile.current_zone_id ?? "Sin zona"}</Text>
          <Text style={styles.meta}>DNI: {profile.dni_number ?? "No informado"}</Text>
          <Text style={styles.meta}>Emergencia: {profile.emergency_contact_name ?? "-"} {profile.emergency_contact_phone ?? ""}</Text>
          <AppButton title="Cerrar sesión" icon="log-out-outline" onPress={() => void handleLogout()} variant="ghost" fullWidth />
        </Card>
      ) : (
        <StateMessage title="Perfil no disponible" actionLabel="Reintentar" onAction={() => void load()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  }
});
