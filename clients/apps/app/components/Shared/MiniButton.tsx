import { useTheme } from "@/hooks/theme";
import {
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";
import { ThemedText } from "./ThemedText";

interface MiniButtonProps extends TouchableOpacityProps {
  icon?: React.ReactNode;
  secondary?: boolean;
}

export const MiniButton = ({
  children,
  onPress,
  style,
  icon,
  secondary,
  disabled,
  ...props
}: MiniButtonProps) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      style={[
        styles.button,
        {
          backgroundColor: disabled
            ? colors.secondary
            : secondary
            ? colors.secondary
            : colors.primary,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      {...props}
    >
      {icon && <View style={{ marginRight: 4 }}>{icon}</View>}
      <ThemedText
        style={{ fontSize: 14, fontWeight: "500" }}
        secondary={disabled}
      >
        {children}
      </ThemedText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: "auto",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
