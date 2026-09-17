---
'@polar-sh/better-auth': patch
---

Do not claim an existing team customer as an individual customer on signup. `onAfterUserCreate` now filters the relink path to individual customers only and throws a CONFLICT when a team customer already holds the signup email, instead of overwriting the team customer's `external_id` with the new user's id (which left the user without an individual customer and corrupted the team customer).
