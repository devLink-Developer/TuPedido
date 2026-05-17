import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { TextField } from "../../components/TextField";
import { colors, radii, spacing, touchTarget } from "../../theme";
import { PRIVACY_POLICY_URL, TERMS_URL } from "../../config/legal";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import type { AuthStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { hasAuthFieldErrors, normalizeEmail, validateRegisterForm, type AuthFieldErrors } from "../../utils/authValidation";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register, loading } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleRegister() {
    const nextErrors = validateRegisterForm({ fullName, email, password, confirmPassword });
    setFieldErrors(nextErrors);
    if (hasAuthFieldErrors(nextErrors)) {
      return;
    }
    if (!acceptedTerms) {
      showDialog({
        title: "Aceptacion requerida",
        message: "Para crear tu cuenta debes aceptar los terminos y la politica de privacidad.",
        variant: "warning"
      });
      return;
    }
    try {
      await register(fullName.trim(), normalizeEmail(email), password, acceptedTerms);
    } catch (error) {
      showError("No se pudo registrar", friendlyErrorMessage(error));
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <Screen contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        <View style={styles.brandRow}>
          <BrandWordmark height={38} width={166} />
        </View>
        <SectionHeader
          size="large"
          title="Crear cuenta cliente"
          description="Registrate para pedir, guardar tus direcciones y seguir cada pedido."
        />
        <Card style={styles.form}>
          <TextField
            label="Nombre completo"
            leftIcon="person-outline"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setFieldErrors((current) => ({ ...current, fullName: undefined }));
            }}
            textContentType="name"
            autoComplete="name"
            error={fieldErrors.fullName}
          />
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
              setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }));
            }}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="password-new"
            error={fieldErrors.password}
            rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
            rightActionLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            rightActionSelected={showPassword}
            onRightActionPress={() => setShowPassword((current) => !current)}
          />
          <TextField
            label="Repetir contraseña"
            leftIcon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
            }}
            secureTextEntry={!showConfirmPassword}
            textContentType="newPassword"
            autoComplete="password-new"
            error={fieldErrors.confirmPassword}
            rightIcon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
            rightActionLabel={showConfirmPassword ? "Ocultar repeticion de contraseña" : "Mostrar repeticion de contraseña"}
            rightActionSelected={showConfirmPassword}
            onRightActionPress={() => setShowConfirmPassword((current) => !current)}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="Aceptar terminos y politica de privacidad"
            hitSlop={6}
            android_ripple={{ color: colors.borderStrong }}
            style={({ pressed }) => [styles.legalConsent, pressed && styles.pressed]}
            onPress={() => setAcceptedTerms((current) => !current)}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.legalText}>Acepto los terminos y condiciones y la politica de privacidad.</Text>
          </Pressable>
          <AppButton title="Registrarme" icon="person-add-outline" onPress={handleRegister} loading={loading} disabled={!acceptedTerms} fullWidth />
          <AppButton title="Terminos y condiciones" icon="document-text-outline" onPress={() => void Linking.openURL(TERMS_URL)} variant="ghost" fullWidth />
          <AppButton title="Politica de privacidad" icon="shield-checkmark-outline" onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} variant="ghost" fullWidth />
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
  content: {
    paddingBottom: 144
  },
  brandRow: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md
  },
  form: {
    gap: spacing.md,
    borderRadius: radii.lg
  },
  legalConsent: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.md
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surface
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  legalText: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.78
  }
});
