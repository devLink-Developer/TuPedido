import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";
import { brandAssets } from "../assets/brand";

type BrandWordmarkProps = {
  height?: number;
  width?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandWordmark({ height = 40, width = 158, style }: BrandWordmarkProps) {
  return (
    <Image
      source={brandAssets.wordmark}
      resizeMode="contain"
      style={[styles.wordmark, { height, width }, style]}
      accessibilityLabel="KePedimos"
    />
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexShrink: 0
  }
});
