export default defineEventHandler((event) => {
  const {
    private: { polarWebhookSecret },
  } = useRuntimeConfig();

  const webhooksHandler = Webhooks({
    webhookSecret: polarWebhookSecret,
    onPayload: async () => {
      // Handle the payload
      // No need to return an acknowledge response
    },
  });

  return webhooksHandler(event);
});
