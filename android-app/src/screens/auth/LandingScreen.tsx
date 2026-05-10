import { Image, StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { Screen } from "../../components/Screen";
import { brandAssets } from "../../assets/brand";
import { colors, radii, shadow, spacing } from "../../theme";
import type { AuthStackParamList, RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Landing">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function LandingScreen({ navigation }: Props) {
  const rootNavigation = navigation.getParent<RootNav>();

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BrandWordmark height={46} width={205} />
        <Image source={brandAssets.logo} resizeMode="cover" style={styles.logo} accessibilityLabel="KePedimos" />
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Hecho para tu día a día</Text>
        <Text style={styles.title}>Pedí cerca. Resolvé rápido.</Text>
        <Text style={styles.highlight}>Sin vueltas.</Text>
        <Text style={styles.description}>
          Encontrá comercios de tu zona, compará opciones y elegí envío o retiro en minutos.
        </Text>
      </View>

      <View style={styles.actions}>
        <AppButton title="Explorar comercios" icon="search-outline" fullWidth onPress={() => rootNavigation?.navigate("PublicCatalog")} />
        <AppButton title="Ingresar" icon="log-in-outline" variant="ghost" fullWidth onPress={() => navigation.navigate("Login")} />
        <AppButton title="Crear cuenta" icon="person-add-outline" variant="ghost" fullWidth onPress={() => navigation.navigate("Register")} />
      </View>

      <View style={styles.features}>
        <Feature icon="location-outline" title="Comercios cercanos" text="Opciones reales cerca tuyo." />
        <Feature icon="bag-handle-outline" title="Envío o retiro" text="Vos elegís cómo recibirlo." />
        <Feature icon="time-outline" title="Rápido" text="Menos pasos para pedir." />
      </View>
    </Screen>
  );
}

function Feature({ icon, title, text }: { icon: ComponentProps<typeof Ionicons>["name"]; title: string; text: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    justifyContent: "center"
  },
  header: {
    alignItems: "center",
    gap: spacing.md
  },
  logo: {
    width: 150,
    height: 150,
    borderRadius: 38,
    backgroundColor: colors.surface,
    ...shadow.medium
  },
  copy: {
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  highlight: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  description: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm
  },
  actions: {
    gap: spacing.sm
  },
  features: {
    gap: spacing.sm
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  featureCopy: {
    flex: 1,
    minWidth: 0
  },
  featureTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  featureText: {
    color: colors.mutedText,
    marginTop: 2
  }
});
