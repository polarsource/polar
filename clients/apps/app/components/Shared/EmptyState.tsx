import { useTheme } from "@/hooks/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View, StyleSheet } from "react-native";
import { ThemedText } from "./ThemedText";

export interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <ThemedText style={[styles.title]}>{title}</ThemedText>
      <ThemedText style={[styles.description]} secondary>
        {description}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 48,
    borderWidth: 1,
    gap: 8,
    borderRadius: 16,
  },
  title: {
    fontSize: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
  },
});
