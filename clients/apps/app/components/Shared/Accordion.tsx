import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "./ThemedText";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTheme } from "@/hooks/theme";

export interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const Accordion = ({
  title,
  children,
  defaultOpen = false,
}: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.card }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.6}
      >
        <ThemedText style={styles.title}>{title}</ThemedText>
        <MaterialIcons
          name={open ? "expand-less" : "expand-more"}
          size={24}
          color={colors.monochromeInverted}
        />
      </TouchableOpacity>
      {open && children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  title: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 16,
  },
});
