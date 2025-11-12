import { View, StyleSheet } from "react-native";
import { ThemedText } from "../Shared/ThemedText";
import { formatCurrencyAndAmount } from "@/utils/money";
import { useTheme } from "@/hooks/theme";

export interface BoxProps {
  label: string;
  value: string;
}

export const Box = ({ label, value }: BoxProps) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <ThemedText style={styles.label} secondary>
        {label}
      </ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    flex: 1,
    gap: 8,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
});
