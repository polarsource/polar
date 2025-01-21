from fastapi import APIRouter

from polar.account.endpoints import router as accounts_router
from polar.advertisement.endpoints import router as advertisements_router
from polar.auth.endpoints import router as auth_router
from polar.backoffice.endpoints import router as backoffice_router
from polar.benefit.endpoints import router as benefits_router
from polar.checkout.endpoints import router as checkout_router
from polar.checkout.legacy.endpoints import router as checkout_legacy_router
from polar.checkout_link.endpoints import router as checkout_link_router
from polar.custom_field.endpoints import router as custom_field_router
from polar.customer.endpoints import router as customer_router
from polar.customer_portal.endpoints import router as customer_portal_router
from polar.customer_session.endpoints import router as customer_session_router
from polar.dashboard.endpoints import router as dashboard_router
from polar.discount.endpoints import router as discount_router
from polar.email_update.endpoints import router as email_update_router
from polar.embed.endpoints import router as embed_router
from polar.eventstream.endpoints import router as stream_router
from polar.external_organization.endpoints import router as external_organization_router
from polar.file.endpoints import router as files_router
from polar.funding.endpoints import router as funding_router
from polar.integrations.discord.endpoints import router as discord_router
from polar.integrations.github.endpoints import router as github_router
from polar.integrations.github_repository_benefit.endpoints import (
    router as github_repository_benefit_router,
)
from polar.integrations.google.endpoints import router as google_router
from polar.integrations.plain.endpoints import router as plain_router
from polar.integrations.stripe.endpoints import router as stripe_router
from polar.issue.endpoints import router as issue_router
from polar.license_key.endpoints import router as license_key_router
from polar.magic_link.endpoints import router as magic_link_router
from polar.metrics.endpoints import router as metrics_router
from polar.notifications.endpoints import router as notifications_router
from polar.oauth2.endpoints.oauth2 import router as oauth2_router
from polar.order.endpoints import router as order_router
from polar.organization.endpoints import router as organization_router
from polar.payment_method.endpoints import router as payment_method_router
from polar.personal_access_token.endpoints import router as pat_router
from polar.pledge.endpoints import router as pledge_router
from polar.product.endpoints import router as product_router
from polar.refund.endpoints import router as refund_router
from polar.repository.endpoints import router as repository_router
from polar.reward.endpoints import router as rewards_router
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
# /backoffice
router.include_router(backoffice_router)
# /dashboard
router.include_router(dashboard_router)
# /funding
router.include_router(funding_router)
# /magic-link
router.include_router(magic_link_router)
# /notifications
router.include_router(notifications_router)
# /external-organizations
router.include_router(external_organization_router)
# /repositories
router.include_router(repository_router)
# /rewards
router.include_router(rewards_router)
# /personal_access_tokens
router.include_router(pat_router)
# /payment_methods
router.include_router(payment_method_router)
# /{platform}/{org_name}/{repo_name}/accounts
# /accounts
router.include_router(accounts_router)
# /issues
router.include_router(issue_router)
# /pledges
router.include_router(pledge_router)
# /stream
router.include_router(stream_router)
# /organizations
router.include_router(organization_router)
# /subscriptions
router.include_router(subscription_router)
# /transactions
router.include_router(transaction_router)
# /advertisements
router.include_router(advertisements_router)
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
# /checkouts/custom
router.include_router(checkout_router)
# /checkouts
router.include_router(checkout_legacy_router)
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
