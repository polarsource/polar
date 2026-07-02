from polar.merchant_migration.stripe_oauth import StripeOAuthToken


def build_stripe_oauth_token(refresh_token: str = "rt_secret") -> StripeOAuthToken:
    return StripeOAuthToken(
        access_token="rk_test",
        refresh_token=refresh_token,
        stripe_user_id="acct_test",
        scope="customer_read",
        livemode=True,
    )
