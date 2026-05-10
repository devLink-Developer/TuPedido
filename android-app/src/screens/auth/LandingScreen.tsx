import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { Screen } from "../../components/Screen";
import { brandAssets } from "../../assets/brand";
import { colors, opacity, radii, shadow, spacing, touchTarget } from "../../theme";
import type { AuthStackParamList, RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Landing">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type IconName = ComponentProps<typeof Ionicons>["name"];

const categories: Array<{ label: string; icon: IconName }> = [
  { label: "Farmacia", icon: "medical-outline" },
  { label: "Almacén", icon: "storefront-outline" },
  { label: "Comida", icon: "restaurant-outline" },
  { label: "Bebidas", icon: "wine-outline" },
  { label: "Más", icon: "grid-outline" }
];

const valueItems: Array<{ title: string; text: string; icon: IconName }> = [
  { title: "Comercios cercanos", text: "Opciones reales cerca de vos.", icon: "location-outline" },
  { title: "Envío o retiro", text: "Elegí cómo lo recibís.", icon: "bag-handle-outline" },
  { title: "Compará mejor", text: "Menos vueltas para decidir.", icon: "search-outline" }
];

export function LandingScreen({ navigation }: Props) {
  const rootNavigation = navigation.getParent<RootNav>();

  function openCatalog() {
    rootNavigation?.navigate("PublicCatalog");
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <BrandWordmark height={42} width={184} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ingresar"
          hitSlop={6}
          android_ripple={{ color: colors.borderStrong }}
          style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.loginText}>Ingresar</Text>
        </Pressable>
      </View>

      <View style={styles.heroCopy}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>HECHO PARA TU DÍA A DÍA</Text>
        </View>
        <Text style={styles.title}>
          Pedí cerca.{"\n"}
          Resolvé rápido.{"\n"}
          <Text style={styles.titleAccent}>Sin vueltas.</Text>
        </Text>
        <Text style={styles.description}>
          Encontrá comercios en tu zona, compará opciones y elegí envío o retiro en minutos.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buscar comercios o productos"
        accessibilityHint="Abre el catálogo de comercios"
        android_ripple={{ color: colors.borderStrong }}
        style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
        onPress={openCatalog}
      >
        <View style={styles.searchCopy}>
          <Ionicons name="search-outline" size={20} color={colors.mutedText} />
          <Text style={styles.searchPlaceholder}>¿Qué necesitás hoy?</Text>
        </View>
        <View style={styles.searchAction}>
          <Text style={styles.searchActionText}>Buscar</Text>
        </View>
      </Pressable>

      <View style={styles.categoryRow} accessibilityLabel="Rubros destacados">
        {categories.map((category) => (
          <Pressable
            key={category.label}
            accessibilityRole="button"
            accessibilityLabel={`Ver ${category.label}`}
            hitSlop={4}
            android_ripple={{ color: colors.borderStrong }}
            style={({ pressed }) => [styles.categoryPill, pressed && styles.pressed]}
            onPress={openCatalog}
          >
            <Ionicons name={category.icon} size={16} color={colors.text} />
            <Text style={styles.categoryLabel}>{category.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <AppButton title="Buscar comercios" icon="storefront-outline" fullWidth onPress={openCatalog} />
        <AppButton title="Crear cuenta" icon="person-add-outline" variant="ghost" fullWidth onPress={() => navigation.navigate("Register")} />
      </View>

      <View style={styles.posterPanel}>
        <Image
          source={brandAssets.landingPoster}
          resizeMode="cover"
          style={styles.posterImage}
          accessibilityLabel="Vista de KePedimos con búsqueda, mapa y comercios cercanos"
        />
      </View>

      <View style={styles.valueStrip}>
        {valueItems.map((item) => (
          <ValueItem key={item.title} icon={item.icon} title={item.title} text={item.text} />
        ))}
      </View>

      <View style={styles.deliveryHint}>
        <Image source={brandAssets.mapOrange} resizeMode="cover" style={styles.mapImage} accessibilityIgnoresInvertColors />
        <View style={styles.mapOverlay}>
          <View style={styles.pinBubble}>
            <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.mapTextBlock}>
            <Text style={styles.mapTitle}>Pedido cerca de vos</Text>
            <Text style={styles.mapText}>Entrá, elegí y seguí el estado desde la app.</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ValueItem({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.valueItem}>
      <View style={styles.valueIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.valueCopy}>
        <Text style={styles.valueTitle}>{title}</Text>
        <Text style={styles.valueText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl
  },
  brandRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  loginButton: {
    minHeight: touchTarget.min,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md
  },
  loginText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800"
  },
  heroCopy: {
    gap: spacing.sm,
    paddingTop: spacing.xs
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: 0
  },
  titleAccent: {
    color: colors.primary
  },
  description: {
    maxWidth: 340,
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600"
  },
  searchBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    ...shadow.soft
  },
  searchCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchPlaceholder: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700"
  },
  searchAction: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md
  },
  searchActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  categoryPill: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md
  },
  categoryLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800"
  },
  actions: {
    gap: spacing.sm
  },
  posterPanel: {
    height: 164,
    overflow: "hidden",
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadow.medium
  },
  posterImage: {
    width: "100%",
    height: "100%"
  },
  valueStrip: {
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm
  },
  valueItem: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  valueIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft
  },
  valueCopy: {
    flex: 1,
    minWidth: 0
  },
  valueTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  valueText: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  deliveryHint: {
    minHeight: 150,
    overflow: "hidden",
    borderRadius: radii.xl,
    backgroundColor: "#090909"
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.78
  },
  mapOverlay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md
  },
  pinBubble: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primary
  },
  mapTextBlock: {
    flex: 1,
    minWidth: 0
  },
  mapTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900"
  },
  mapText: {
    marginTop: 4,
    color: "#F8FAFC",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  pressed: {
    opacity: opacity.pressed
  }
});
