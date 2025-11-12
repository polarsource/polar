import { useTheme } from "@/hooks/theme";
import { useNotificationsBadge } from "@/hooks/notifications";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link } from "expo-router";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { themes } from "@/utils/theme";

export const NotificationBadge = () => {
  const { colors } = useTheme();
  const showBadge = useNotificationsBadge();

  return (
    <Link href="/notifications" asChild>
      <TouchableOpacity activeOpacity={0.6} style={styles.container}>
        <MaterialIcons name="bolt" size={24} color={colors.text} />
        {showBadge && <View style={styles.badge} />}
      </TouchableOpacity>
    </Link>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: themes.dark.primary,
  },
});
