export default defineNuxtConfig({
  modules: ["../src/module"],
  polar: {},
  devtools: { enabled: true },
  compatibilityDate: "2025-02-25",
  runtimeConfig: {
    private: {
      polarAccessToken: "",
      polarServer: "",
      polarCheckoutSuccessUrl: "",
      polarWebhookSecret: "",
    },
  },
});
