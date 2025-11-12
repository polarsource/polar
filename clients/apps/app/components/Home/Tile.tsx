import { useTheme } from "@/hooks/theme";
import { Link, Href } from "expo-router";
import { PropsWithChildren } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

export interface TileProps extends PropsWithChildren {
  href: Href;
}

export const Tile = ({ href, children }: TileProps) => {
  const { colors } = useTheme();

  return (
    <Link
      href={href}
      style={[TileStyle.container, { backgroundColor: colors.card }]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>{children}</TouchableOpacity>
    </Link>
  );
};

const TileStyle = StyleSheet.create({
  container: {
    backgroundColor: "#1c1c1e",
    padding: 20,
    borderRadius: 24,
    flex: 1,
    aspectRatio: 1,
  },
});
