import { useTheme } from "@/hooks/theme";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { ThemedText } from "./ThemedText";

export const Details = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </View>
  );
};

export const DetailRow = ({
  label,
  labelStyle,
  value,
  valueStyle,
}: {
  label: string;
  labelStyle?: StyleProp<TextStyle>;
  value?: React.ReactNode;
  valueStyle?: StyleProp<TextStyle>;
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <ThemedText style={[styles.label, labelStyle]} secondary>
        {label}
      </ThemedText>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          styles.value,
          { color: value ? colors.text : colors.subtext },
          valueStyle,
        ]}
      >
        {value ? value : "—"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
    width: "auto",
    textAlign: "right",
  },
});
