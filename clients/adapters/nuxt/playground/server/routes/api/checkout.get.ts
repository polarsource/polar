export default defineEventHandler((event) => {
  const {
    private: { polarAccessToken, polarCheckoutSuccessUrl, polarServer },
  } = useRuntimeConfig();

  const checkoutHandler = Checkout({
    accessToken: polarAccessToken,
    successUrl: polarCheckoutSuccessUrl,
    server: polarServer as "sandbox" | "production",
  });

  return checkoutHandler(event);
});
