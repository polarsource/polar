from fastapi import APIRouter

from polar.account.endpoints import router as accounts_router
from polar.backoffice.endpoints import router as backoffice_router
from polar.dashboard.endpoints import router as dashboard_router
from polar.eventstream.endpoints import router as stream_router
from polar.extension.endpoints import router as extension_router
from polar.integrations.github.endpoints import router as github_router
from polar.integrations.stripe.endpoints import router as stripe_router
from polar.issue.endpoints import router as issue_router
from polar.notifications.endpoints import router as notifications_router
from polar.organization.endpoints import router as organization_router
from polar.payment_method.endpoints import router as payment_method_router
from polar.personal_access_token.endpoints import router as pat_router
from polar.pledge.endpoints import router as pledge_router
from polar.pull_request.endpoints import router as pull_request_router
from polar.repository.endpoints import router as repository_router
from polar.reward.endpoints import router as rewards_router
from polar.user.endpoints import router as user_router

router = APIRouter(prefix="/api/v1")

# /users
router.include_router(user_router)
# /integrations/github
router.include_router(github_router)
# /integrations/stripe
router.include_router(stripe_router)
# /backoffice
router.include_router(backoffice_router)
# /dashboard
router.include_router(dashboard_router)
# /extension
router.include_router(extension_router)
# /notifications
router.include_router(notifications_router)
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
# /{platform}/{org_name}/{repo_name}/pulls
router.include_router(pull_request_router)
# /{platform}/{org_name}/{repo_name}/issues
router.include_router(issue_router)
# /{platform}/{org_name}/{repo_name}/pledges
router.include_router(pledge_router)
# /{org_name}/stream
# /{org_name}/{repo_name}/stream
router.include_router(stream_router)
# /{platform}/{org_name}/
router.include_router(organization_router)
