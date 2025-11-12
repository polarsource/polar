import {
  exchangeCodeAsync,
  makeRedirectUri,
  Prompt,
  useAuthRequest,
} from "expo-auth-session";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useSession } from "@/providers/SessionProvider";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export const useOAuthConfig = () => {
  const production = {
    CLIENT_ID: "polar_ci_yZLBGwoWZVsOdfN5CODRwVSTlJfwJhXqwg65e2CuNMZ",
    discovery: {
      authorizationEndpoint: "https://polar.sh/oauth2/authorize",
      tokenEndpoint: "https://api.polar.sh/v1/oauth2/token",
      registrationEndpoint: "https://api.polar.sh/v1/oauth2/register",
      revocationEndpoint: "https://api.polar.sh/v1/oauth2/revoke",
    },
  };

  const development = {
    CLIENT_ID: "polar_ci_VoDM10HGgcetzWmJnQ9QDDdQHX1kXoX96L7aD4eMVmK",
    discovery: {
      authorizationEndpoint: `http://127.0.0.1:3000/oauth2/authorize`,
      tokenEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/token`,
      registrationEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/register`,
      revocationEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/revoke`,
    },
  };

  const scopes = [
    "openid",
    "profile",
    "email",
    "user:read",
    "checkout_links:read",
    "checkout_links:write",
    "organizations:read",
    "organizations:write",
    "orders:read",
    "products:read",
    "products:write",
    "benefits:read",
    "benefits:write",
    "transactions:read",
    "transactions:write",
    "payouts:read",
    "payouts:write",
    "discounts:read",
    "discounts:write",
    "customers:read",
    "customers:write",
    "customer_meters:read",
    "refunds:read",
    "refunds:write",
    "payments:read",
    "license_keys:read",
    "license_keys:write",
    "metrics:read",
    "events:read",
    "subscriptions:read",
    "subscriptions:write",
    "notifications:read",
    "notifications:write",
    "notification_recipients:read",
    "notification_recipients:write",
  ];

  return {
    scopes,
    ...production,
  };
};

export const useOAuth = () => {
  const { navigate } = useRouter();
  const { setSession } = useSession();

  useEffect(() => {
    WebBrowser.warmUpAsync();

    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  const { CLIENT_ID, scopes, discovery } = useOAuthConfig();
  const [authRequest, , promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes,
      redirectUri: makeRedirectUri({
        scheme: "polar",
        path: "oauth/callback",
      }),
      prompt: Prompt.Consent,
      usePKCE: true,
    },
    discovery
  );

  const authenticate = async () => {
    const response = await promptAsync();

    if (response?.type !== "success") {
      return;
    }

    const token = await exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code: response.params.code,
        redirectUri: makeRedirectUri({
          scheme: "polar",
          path: "oauth/callback",
        }),
        extraParams: {
          code_verifier: authRequest?.codeVerifier ?? "",
        },
      },
      discovery
    );

    setSession(token.accessToken);
  };

  return { authRequest, authenticate };
};
