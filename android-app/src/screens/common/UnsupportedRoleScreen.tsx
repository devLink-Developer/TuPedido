import { StyleSheet, Text } from "react-native";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { colors, spacing } from "../../theme";
import { useAuth } from "../../state/AuthContext";

export function UnsupportedRoleScreen() {
  const { user, logout } = useAuth();
  return (
    <Screen contentContainerStyle={styles.content}>
      <SectionHeader title="Rol no disponible en Android v1" description="La app nativa cubre cliente y repartidor. Comercio y admin siguen funcionando desde la PWA." />
      <Card style={styles.card}>
        <Text style={styles.role}>Cuenta: {user?.email}</Text>
        <Text style={styles.role}>Rol: {user?.role}</Text>
        <AppButton title="Cerrar sesión" onPress={() => void logout()} variant="ghost" fullWidth />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
    flexGrow: 1
  },
  card: {
    gap: spacing.md
  },
  role: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  }
});
