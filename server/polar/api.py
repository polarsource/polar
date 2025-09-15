from fastapi import APIRouter

from polar.account.endpoints import router as accounts_router
from polar.auth.endpoints import router as auth_router
from polar.benefit.endpoints import router as benefits_router
from polar.checkout.endpoints import router as checkout_router
from polar.checkout_link.endpoints import router as checkout_link_router
from polar.custom_field.endpoints import router as custom_field_router
from polar.customer.endpoints import router as customer_router
from polar.customer_meter.endpoints import router as customer_meter_router
from polar.customer_portal.endpoints import router as customer_portal_router
from polar.customer_session.endpoints import router as customer_session_router
from polar.discount.endpoints import router as discount_router
from polar.email_update.endpoints import router as email_update_router
from polar.embed.endpoints import router as embed_router
from polar.event.endpoints import router as event_router
from polar.eventstream.endpoints import router as stream_router
from polar.file.endpoints import router as files_router
from polar.integrations.discord.endpoints import router as discord_router
from polar.integrations.github.endpoints import router as github_router
from polar.integrations.github_repository_benefit.endpoints import (
    router as github_repository_benefit_router,
)
from polar.integrations.google.endpoints import router as google_router
from polar.integrations.plain.endpoints import router as plain_router
from polar.integrations.stripe.endpoints import router as stripe_router
from polar.license_key.endpoints import router as license_key_router
from polar.login_code.endpoints import router as login_code_router
from polar.meter.endpoints import router as meter_router
from polar.metrics.endpoints import router as metrics_router
from polar.notifications.endpoints import router as notifications_router
from polar.oauth2.endpoints.oauth2 import router as oauth2_router
from polar.order.endpoints import router as order_router
from polar.organization.endpoints import router as organization_router
from polar.organization_access_token.endpoints import (
    router as organization_access_token_router,
)
from polar.payment.endpoints import router as payment_router
from polar.payout.endpoints import router as payout_router
from polar.personal_access_token.endpoints import router as pat_router
from polar.product.endpoints import router as product_router
from polar.refund.endpoints import router as refund_router
from polar.storefront.endpoints import router as storefront_router
from polar.subscription.endpoints import router as subscription_router
from polar.transaction.endpoints import router as transaction_router
from polar.user.endpoints import router as user_router
from polar.webhook.endpoints import router as webhook_router

router = APIRouter(prefix="/v1")

# /users
router.include_router(user_router)
# /integrations/github
router.include_router(github_router)
# /integrations/github_repository_benefit
router.include_router(github_repository_benefit_router)
# /integrations/stripe
router.include_router(stripe_router)
# /integrations/discord
router.include_router(discord_router)
# /login-code
router.include_router(login_code_router)
# /notifications
router.include_router(notifications_router)
# /personal_access_tokens
router.include_router(pat_router)
# /accounts
router.include_router(accounts_router)
# /stream
router.include_router(stream_router)
# /organizations
router.include_router(organization_router)
# /subscriptions
router.include_router(subscription_router)
# /transactions
router.include_router(transaction_router)
# /auth
router.include_router(auth_router)
# /oauth2
router.include_router(oauth2_router)
# /benefits
router.include_router(benefits_router)
# /webhooks
router.include_router(webhook_router)
# /products
router.include_router(product_router)
# /orders
router.include_router(order_router)
# /refunds
router.include_router(refund_router)
# /checkouts
router.include_router(checkout_router)
# /files
router.include_router(files_router)
# /metrics
router.include_router(metrics_router)
# /integrations/google
router.include_router(google_router)
# /license-keys
router.include_router(license_key_router)
# /checkout-links
router.include_router(checkout_link_router)
# /storefronts
router.include_router(storefront_router)
# /custom-fields
router.include_router(custom_field_router)
# /embed
router.include_router(embed_router)
# /discounts
router.include_router(discount_router)
# /customers
router.include_router(customer_router)
# /customer-portal
router.include_router(customer_portal_router)
# /update-email
router.include_router(email_update_router)
# /customer-sessions
router.include_router(customer_session_router)
# /integrations/plain
router.include_router(plain_router)
# /events
router.include_router(event_router)
# /meters
router.include_router(meter_router)
# /organization-access-tokens
router.include_router(organization_access_token_router)
# /customer-meters
router.include_router(customer_meter_router)
# /payments
router.include_router(payment_router)
# /payouts
router.include_router(payout_router)
