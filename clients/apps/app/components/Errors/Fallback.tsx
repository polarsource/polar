import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { SDKError } from "@polar-sh/sdk/models/errors/sdkerror.js";
import PolarLogo from "@/components/Shared/PolarLogo";
import { useLogout } from "@/hooks/auth";
import { useTheme } from "@/hooks/theme";
import { useOAuth } from "@/hooks/oauth";
import { ThemedText } from "../Shared/ThemedText";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";

export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallback = ({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) => {
  const { colors } = useTheme();
  const logout = useLogout();
  const { authenticate } = useOAuth();
  const permissionError =
    (error instanceof SDKError && error.statusCode === 403) ||
    (error instanceof SDKValidationError &&
      error.message.includes("insufficient_scope")) ||
    (error instanceof Error && error.message.includes("privileges"));

  console.log(error);

  const title = useMemo(() => {
    switch (true) {
      case permissionError:
        return "Insufficient Permissions";
      default:
        return "Something Went Wrong";
    }
  }, [permissionError]);

  const message = useMemo(() => {
    switch (true) {
      case permissionError:
        return "You have insufficient permissions to access the resource. Authenticate to gain the necessary permissions.";
      default:
        return "Logout & re-authenticate to try again";
    }
  }, [permissionError]);

  const [actionText, action] = useMemo(() => {
    switch (true) {
      case permissionError:
        return ["Authenticate", authenticate];
      default:
        return ["Logout", logout];
    }
  }, [permissionError, logout, authenticate]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        gap: 32,
        paddingHorizontal: 24,
      }}
    >
      <PolarLogo size={80} />
      <View style={{ gap: 12 }}>
        <ThemedText
          style={{
            fontSize: 24,
            textAlign: "center",
          }}
        >
          {title}
        </ThemedText>
        <ThemedText
          style={{
            fontSize: 16,
            lineHeight: 24,
            textAlign: "center",
          }}
          secondary
        >
          {message}
        </ThemedText>
      </View>
      <TouchableOpacity
        activeOpacity={0.6}
        style={[
          {
            backgroundColor: "#fff",
            borderRadius: 100,
            width: "auto",
            paddingVertical: 12,
            paddingHorizontal: 24,
          },
        ]}
        onPress={async () => {
          await action();
          resetErrorBoundary();
        }}
      >
        <ThemedText style={{ color: "#000", fontSize: 16, fontWeight: "500" }}>
          {actionText}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
};
