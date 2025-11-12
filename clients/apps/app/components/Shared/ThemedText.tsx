import { useTheme } from "@/hooks/theme";
import { Text, TextProps, StyleSheet } from "react-native";
import { MotiText } from "moti";
import { ComponentProps } from "react";

type ThemedTextProps = ComponentProps<typeof MotiText> & {
  secondary?: boolean;
  error?: boolean;
};

export const ThemedText = ({
  secondary,
  error,
  style,
  ...props
}: ThemedTextProps) => {
  const { colors } = useTheme();

  const lineHeight = (fontSize: number) => {
    const multiplier = fontSize > 20 ? 1.5 : 1.4;
    return fontSize * multiplier;
  };

  const styles = StyleSheet.flatten(style);

  return (
    <MotiText
      {...props}
      style={[
        {
          color: error
            ? colors.error
            : secondary
            ? colors.subtext
            : colors.text,
          lineHeight: lineHeight(styles?.fontSize ?? 14),
        },
        styles,
      ]}
    />
  );
};
