import { Linking, StyleSheet, Text } from "react-native";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { PRIVACY_POLICY_URL } from "../../config/legal";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { colors, spacing } from "../../theme";
import { useAuth } from "../../state/AuthContext";

export function UnsupportedRoleScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const { showDialog, showError } = useAppFeedback();

  function requestAccountDeletion() {
    showDialog({
      title: "Eliminar cuenta",
      message: "Se cerrara tu sesion y se eliminaran o anonimizaran tus datos personales. Si tu cuenta opera un comercio, el comercio quedara suspendido.",
      variant: "danger",
      actions: [
        { label: "Cancelar", variant: "ghost" },
        {
          label: "Eliminar",
          variant: "danger",
          onPress: () => {
            void deleteAccount().catch((error) => {
              showError("No pudimos eliminar la cuenta", error instanceof Error ? error.message : "Intentalo nuevamente.");
            });
          }
        }
      ]
    });
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <SectionHeader title="Rol no disponible en Android v1" description="La app nativa cubre cliente y repartidor. Comercio y admin siguen funcionando desde la PWA." />
      <Card style={styles.card}>
        <Text style={styles.role}>Cuenta: {user?.email}</Text>
        <Text style={styles.role}>Rol: {user?.role}</Text>
        <AppButton title="Politica de privacidad" onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} variant="ghost" fullWidth />
        <AppButton title="Eliminar cuenta" onPress={requestAccountDeletion} variant="danger" fullWidth />
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
