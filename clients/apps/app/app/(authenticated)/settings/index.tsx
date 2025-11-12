import { Stack, useRouter } from "expo-router";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import React, { useContext } from "react";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTheme } from "@/hooks/theme";
import { useOrganizations } from "@/hooks/polar/organizations";
import { Avatar } from "@/components/Shared/Avatar";
import { Button } from "@/components/Shared/Button";
import { useLogout } from "@/hooks/auth";
import { ThemedText } from "@/components/Shared/ThemedText";
import { MiniButton } from "@/components/Shared/MiniButton";

export default function Index() {
  const { setOrganization, organization: selectedOrganization } =
    useContext(OrganizationContext);
  const router = useRouter();

  const { colors } = useTheme();
  const { data: organizationData, refetch, isRefetching } = useOrganizations();

  const logout = useLogout();

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      contentInset={{ bottom: 16 }}
      contentContainerStyle={{ flex: 1 }}
    >
      <Stack.Screen options={{ title: "Settings" }} />
      <SafeAreaView style={SettingsStyle.container}>
        <View style={{ flex: 1, gap: 16 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <ThemedText style={[SettingsStyle.title]}>Organizations</ThemedText>
            <MiniButton
              onPress={() => router.push("/onboarding")}
              icon={
                <MaterialIcons
                  name="add"
                  size={16}
                  color={colors.monochromeInverted}
                />
              }
            >
              New
            </MiniButton>
          </View>
          <View style={SettingsStyle.organizationsContainer}>
            {organizationData?.result.items.map((organization) => (
              <TouchableOpacity
                key={organization?.id}
                style={[
                  SettingsStyle.organization,
                  {
                    backgroundColor: colors.card,
                  },
                ]}
                onPress={() => {
                  setOrganization(organization);
                  router.back();
                }}
                activeOpacity={0.6}
              >
                <View style={SettingsStyle.organizationContent}>
                  <Avatar
                    size={32}
                    image={organization?.avatarUrl}
                    name={organization?.name}
                  />
                  <ThemedText style={[SettingsStyle.organizationName]}>
                    {organization?.name}
                  </ThemedText>
                </View>
                <MaterialIcons
                  name="check"
                  size={20}
                  color={
                    selectedOrganization?.id === organization?.id
                      ? colors.monochromeInverted
                      : "transparent"
                  }
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button onPress={logout}>Logout</Button>
      </SafeAreaView>
    </ScrollView>
  );
}

const SettingsStyle = StyleSheet.create({
  container: {
    flex: 1,
    margin: 16,
    gap: 24,
    justifyContent: "space-between",
  },
  organizationsContainer: {
    flexDirection: "column",
    gap: 4,
    flex: 1,
  },
  title: {
    fontSize: 20,
    flex: 1,
  },
  organization: {
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  organizationContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  organizationName: {
    fontSize: 16,
  },
  logoutButtonText: {
    fontSize: 16,
  },
});
