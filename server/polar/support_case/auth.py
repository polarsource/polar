from polar.authz.dependencies import (
    AuthorizeOrgManageRead,
    AuthorizeOrgManageUser,
)

# Merchant support endpoints are org-scoped and gated to org admins, mirroring
# the appeal endpoints. Read accepts read-or-write scope (so read-only
# sessions can view); replies require write.
SupportCaseRead = AuthorizeOrgManageRead
SupportCaseReply = AuthorizeOrgManageUser
