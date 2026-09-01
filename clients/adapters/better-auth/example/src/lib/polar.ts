import { Polar } from "@polar-sh/sdk";

export const polarSDK = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] as string,
  server: "sandbox",
});
