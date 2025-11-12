import { View, Text } from "react-native";
import { Avatar } from "../Shared/Avatar";
import { Tile } from "./Tile";
import { useContext } from "react";
import { useTheme } from "@/hooks/theme";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { ThemedText } from "../Shared/ThemedText";

export const OrganizationTile = () => {
  const { organization } = useContext(OrganizationContext);
  const { colors } = useTheme();

  if (!organization) {
    return null;
  }

  return (
    <Tile href="/settings">
      <View
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Avatar
          name={organization.name}
          image={organization.avatarUrl}
          backgroundColor={organization.avatarUrl ? undefined : colors.primary}
        />
        <View style={{ flexDirection: "column", gap: 4 }}>
          <ThemedText
            style={{
              fontSize: 18,
              fontWeight: "600",
              marginTop: 4,
            }}
          >
            {organization.name}
          </ThemedText>
          <ThemedText style={{ fontSize: 16 }} numberOfLines={1} secondary>
            {organization.slug}
          </ThemedText>
        </View>
      </View>
    </Tile>
  );
};
