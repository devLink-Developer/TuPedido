import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { brandAssets } from "../../assets/brand";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { PRIVACY_POLICY_URL } from "../../config/legal";
import { colors, opacity, radii, shadow, spacing, touchTarget } from "../../theme";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import type { AuthStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { hasAuthFieldErrors, normalizeEmail, validateLoginForm, type AuthFieldErrors } from "../../utils/authValidation";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

function isEmailNotRegisteredError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : null;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return status === 404 && /email|registered|not found|not registered/i.test(message);
}

export function LoginScreen({ navigation }: Props) {
  const { login, loading } = useAuth();
  const { showDialog, showError } = useAppFeedback();
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
      if (isEmailNotRegisteredError(error)) {
        setFieldErrors((current) => ({ ...current, email: "No encontramos una cuenta con ese email." }));
        showDialog({
          title: "Email no registrado",
          message: "No encontramos una cuenta con ese email. Registrate para crear tu cuenta y empezar a pedir.",
          variant: "info",
          actions: [
            { label: "Cancelar", variant: "ghost" },
            { label: "Registrarme", onPress: () => navigation.navigate("Register") }
          ]
        });
        return;
      }
      const message = friendlyErrorMessage(error, "Revisá tus datos e intentá nuevamente.");
      showError("No se pudo iniciar sesión", message);
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
          <View style={styles.accountPrompt}>
            <Text style={styles.accountPromptText}>¿Tenés cuenta? Iniciá sesión.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Registrarme"
              hitSlop={6}
              android_ripple={{ color: colors.borderStrong }}
              style={({ pressed }) => [styles.accountPromptLink, pressed && styles.pressed]}
              onPress={() => navigation.navigate("Register")}
            >
              <Text style={styles.accountPromptLinkText}>¿Aún no tenés cuenta? Registrate</Text>
            </Pressable>
          </View>
          <AppButton title="Iniciar sesión" icon="log-in-outline" onPress={handleLogin} loading={loading} fullWidth />
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
  },
  accountPrompt: {
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  accountPromptText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800"
  },
  accountPromptLink: {
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md
  },
  accountPromptLinkText: {
    color: colors.primaryDark,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  pressed: {
    opacity: opacity.pressed
  }
});
