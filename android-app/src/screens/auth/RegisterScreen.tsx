import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { TextField } from "../../components/TextField";
import { radii, spacing } from "../../theme";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import type { AuthStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register, loading } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      showDialog({
        title: "Datos incompletos",
        message: "Completá nombre, email y una contraseña de al menos 6 caracteres.",
        variant: "warning"
      });
      return;
    }
    try {
      await register(fullName.trim(), email.trim(), password);
    } catch (error) {
      showError("No se pudo registrar", friendlyErrorMessage(error));
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={styles.brandRow}>
          <BrandWordmark height={38} width={166} />
        </View>
        <SectionHeader
          size="large"
          title="Crear cuenta cliente"
          description="Registrate para pedir, guardar tus direcciones y seguir cada pedido."
        />
        <Card style={styles.form}>
          <TextField label="Nombre completo" leftIcon="person-outline" value={fullName} onChangeText={setFullName} textContentType="name" />
          <TextField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" />
          <TextField label="Contraseña" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
          <AppButton title="Registrarme" icon="person-add-outline" onPress={handleRegister} loading={loading} fullWidth />
          <AppButton title="Ya tengo cuenta" icon="arrow-back-outline" onPress={() => navigation.goBack()} variant="ghost" fullWidth />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  brandRow: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md
  },
  form: {
    gap: spacing.md,
    borderRadius: radii.lg
  }
});
