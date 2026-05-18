import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { brandAssets } from "../../assets/brand";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { PRIVACY_POLICY_URL } from "../../config/legal";
import { colors, radii, shadow, spacing } from "../../theme";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import type { AuthStackParamList } from "../../navigation/types";
import { friendlyErrorMessage, withApiDiagnostic } from "../../utils/apiMessages";
import { runtimeDiagnosticLabel } from "../../utils/appDiagnostics";
import { hasAuthFieldErrors, normalizeEmail, validateLoginForm, type AuthFieldErrors } from "../../utils/authValidation";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login, loading } = useAuth();
  const { showError } = useAppFeedback();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  async function handleLogin() {
    const nextErrors = validateLoginForm({ email, password });
    setFieldErrors(nextErrors);
    if (hasAuthFieldErrors(nextErrors)) {
      return;
    }
    try {
      await login(normalizeEmail(email), password);
    } catch (error) {
      const message = friendlyErrorMessage(error, "Revisá tus datos e intentá nuevamente.");
      showError("No se pudo iniciar sesión", withApiDiagnostic(message, error, runtimeDiagnosticLabel()));
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <Screen contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        <View style={styles.hero}>
          <View style={styles.logoFrame}>
            <Image source={brandAssets.logo} style={styles.logo} resizeMode="cover" accessibilityLabel="Logo de KePedimos" />
          </View>
          <BrandWordmark height={45} width={196} />
          <Text style={styles.title}>Entrá a tu cuenta</Text>
          <Text style={styles.description}>Seguí tus pedidos, guardá direcciones y administrá tus entregas desde la app.</Text>
        </View>

        <Card style={styles.form}>
          <TextField
            label="Email"
            leftIcon="mail-outline"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            error={fieldErrors.email}
          />
          <TextField
            label="Contraseña"
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            textContentType="password"
            autoComplete="password"
            error={fieldErrors.password}
            rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
            rightActionLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            rightActionSelected={showPassword}
            onRightActionPress={() => setShowPassword((current) => !current)}
          />
          <AppButton title="Iniciar sesión" icon="log-in-outline" onPress={handleLogin} loading={loading} fullWidth />
          <AppButton title="Crear cuenta cliente" icon="person-add-outline" onPress={() => navigation.navigate("Register")} variant="ghost" fullWidth />
          <AppButton title="Politica de privacidad" icon="shield-checkmark-outline" onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} variant="ghost" fullWidth />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: spacing.lg,
    paddingBottom: 144
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg
  },
  logoFrame: {
    width: 118,
    height: 118,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.medium
  },
  logo: {
    width: "100%",
    height: "100%"
  },
  title: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
    textAlign: "center",
    marginTop: spacing.sm
  },
  description: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: spacing.md
  },
  form: {
    gap: spacing.md,
    borderRadius: radii.lg
  }
});
