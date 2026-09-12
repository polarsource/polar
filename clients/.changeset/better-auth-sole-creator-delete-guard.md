---
'@polar-sh/better-auth': patch
---

Reject sole-creator account deletion with a clean `APIError("BAD_REQUEST")` before Better Auth destroys credential rows. Previously the sole-creator invariant fired inside `databaseHooks.user.delete.before`, which runs after `internalAdapter.deleteUser` has already deleted `account` rows, leaving the user locked out with a 500 and no way to sign in or re-register.
