import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "./AppButton";
import { RatingStars } from "./RatingStars";
import { TextField } from "./TextField";
import { colors, radii, shadow, spacing, typography } from "../theme";
import type { CreateOrderReviewPayload, PendingOrderReview } from "../types/api";
import { formatDateTime } from "../utils/format";

type OrderReviewModalProps = {
  visible: boolean;
  target: PendingOrderReview | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateOrderReviewPayload) => Promise<void> | void;
};

function buildReviewText(orderComment: string, riderComment: string, includeRider: boolean) {
  const parts = [
    orderComment.trim() ? `Pedido: ${orderComment.trim()}` : null,
    includeRider && riderComment.trim() ? `Repartidor: ${riderComment.trim()}` : null
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

export function OrderReviewModal({ visible, target, submitting = false, onClose, onSubmit }: OrderReviewModalProps) {
  const [storeRating, setStoreRating] = useState(5);
  const [riderRating, setRiderRating] = useState(5);
  const [orderComment, setOrderComment] = useState("");
  const [riderComment, setRiderComment] = useState("");

  useEffect(() => {
    if (!visible || !target) return;
    setStoreRating(5);
    setRiderRating(5);
    setOrderComment("");
    setRiderComment("");
  }, [target?.order_id, visible, target]);

  const deliveredLabel = useMemo(() => {
    if (!target?.delivered_at) return null;
    return `Entregado ${formatDateTime(target.delivered_at)}`;
  }, [target?.delivered_at]);

  const reviewTarget = target;
  if (!reviewTarget) return null;
  const currentTarget: PendingOrderReview = reviewTarget;

  async function submit() {
    await onSubmit({
      store_rating: storeRating,
      rider_rating: currentTarget.requires_rider_rating ? riderRating : null,
      review_text: buildReviewText(orderComment, riderComment, currentTarget.requires_rider_rating)
    });
  }

  return (
    <Modal animationType="fade" transparent visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <View style={styles.iconWrap}>
                <Ionicons name="star" size={28} color={colors.warning} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>Calificá tu experiencia</Text>
                <Text style={styles.subtitle}>
                  {currentTarget.store_name}
                  {deliveredLabel ? ` · ${deliveredLabel}` : ""}
                </Text>
              </View>
            </View>

            <View style={styles.block}>
              <RatingStars
                label="Pedido"
                value={storeRating}
                onChange={setStoreRating}
                helperText="Valorá la calidad, preparación y experiencia con el comercio."
              />
              <TextField
                label="Comentario del pedido"
                value={orderComment}
                onChangeText={setOrderComment}
                placeholder="Contanos qué salió bien o qué se puede mejorar"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                inputContainerStyle={styles.textAreaShell}
                style={styles.textArea}
              />
            </View>

            {currentTarget.requires_rider_rating ? (
              <View style={styles.block}>
                <RatingStars
                  label={currentTarget.rider_name ? `Repartidor: ${currentTarget.rider_name}` : "Repartidor"}
                  value={riderRating}
                  onChange={setRiderRating}
                  helperText="Valorá puntualidad, trato y cuidado de la entrega."
                />
                <TextField
                  label="Comentario del repartidor"
                  value={riderComment}
                  onChangeText={setRiderComment}
                  placeholder="Opcional"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  inputContainerStyle={styles.textAreaShell}
                  style={styles.textArea}
                />
              </View>
            ) : null}

            <View style={styles.actions}>
              <AppButton title="Ahora no" onPress={onClose} variant="ghost" disabled={submitting} />
              <AppButton title="Enviar calificación" icon="star-outline" onPress={() => void submit()} loading={submitting} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.5)"
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    ...shadow.medium
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningSoft
  },
  heroCopy: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.mutedText,
    marginTop: 2,
    ...typography.body
  },
  block: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt
  },
  textAreaShell: {
    alignItems: "flex-start",
    paddingTop: spacing.sm
  },
  textArea: {
    minHeight: 76
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
    flexWrap: "wrap",
    paddingTop: spacing.sm
  }
});
