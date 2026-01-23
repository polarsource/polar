WITH creator_signup_organizations AS (
	SELECT
		users.id AS user_id,
		users.email,
		users.meta->'signup'->>'intent' AS signup_intent,
		organizations.id AS organization_id,
		organizations.slug AS organization_slug,
		organizations.created_at,
		CASE WHEN organizations.donations_enabled THEN 1 ELSE 0 END AS organization_donation_enabled,
		CASE WHEN accounts.account_type = 'stripe' THEN 1 ELSE 0 END AS organization_stripe_account,
		CASE WHEN organizations.profile_settings->'enabled' = 'true' THEN 1 ELSE 0 END AS storefront_enabled,
		FIRST_VALUE (organizations.slug) OVER (PARTITION BY users.id ORDER BY organizations.created_at ASC) AS first_organization_slug
	FROM users
	LEFT JOIN user_organizations ON user_organizations.user_id = users.id
	LEFT JOIN organizations ON organizations.id = user_organizations.organization_id
	LEFT JOIN accounts ON accounts.id = organizations.account_id
	WHERE 1 = 1
		AND (
			users.meta->'signup'->>'intent' = 'creator'
			OR user_organizations.organization_id IS NOT NULL
		)
), creator_signups AS (
	SELECT
		user_id,
		email,
		signup_intent,
		first_organization_slug,
		MAX(organization_donation_enabled) AS donations_enabled,
		MAX(organization_stripe_account) AS stripe_account,
		MAX(storefront_enabled) AS storefront_enabled,
		COUNT(DISTINCT organization_id) AS organizations
	FROM creator_signup_organizations
	GROUP BY 1, 2, 3, 4
), oauth_logins AS (
	SELECT
		oauth_accounts.user_id,
		oauth_accounts.platform,
		TRUE AS login
	FROM oauth_accounts
	JOIN creator_signups ON oauth_accounts.user_id = creator_signups.user_id
	GROUP BY 1, 2
), products_created AS (
	SELECT
		creator_signup_organizations.user_id,
		COUNT(*) AS amount
	FROM products
	JOIN creator_signup_organizations ON products.organization_id = creator_signup_organizations.organization_id
	WHERE 1 = 1
		-- Filter out the automatic free products we used to create
		AND products.name != 'Free'
	GROUP BY 1
), user_pats AS (
	SELECT
		pat.user_id,
		COUNT(*) AS amount
	FROM personal_access_tokens AS pat
	JOIN creator_signups ON pat.user_id = creator_signups.user_id
	GROUP BY 1
), github_orgs AS (
	SELECT
		creator_signup_organizations.user_id,
		COUNT(DISTINCT external_organizations.id) AS installations,
		COUNT(DISTINCT issues.id) AS issues_badged
	FROM external_organizations
	JOIN creator_signup_organizations ON external_organizations.organization_id = creator_signup_organizations.organization_id
	LEFT JOIN issues ON issues.organization_id = external_organizations.id AND issues.pledge_badge_embedded_at IS NOT NULL
	GROUP BY 1
), loops_csv AS (
	SELECT
		u.user_id AS "userId",
		u.email,
		'creator' AS "userGroup",
		u.signup_intent AS "signupIntent",

		(github_logins.login IS NULL AND google_logins.login IS NULL) AS "emailLogin",
		COALESCE(github_logins.login, FALSE) AS "githubLogin",
		COALESCE(google_logins.login, FALSE) AS "googleLogin",

		(u.organizations > 0) AS "organizationCreated",
		u.first_organization_slug AS "organizationSlug",
		u.organizations AS "organizationCount",

		(COALESCE(products_created.amount, 0) > 0) AS "productCreated",
		(COALESCE(user_pats.amount, 0) > 0) AS "userPatCreated",
		(u.storefront_enabled > 0) AS "storefrontEnabled",

		CASE
			WHEN u.stripe_account > 0 THEN 'stripe'
			ELSE NULL
		END AS "accountType",

		(u.donations_enabled > 0) AS "donationsEnabled",

		(COALESCE(github_orgs.installations, 0) > 0) AS "githubOrgInstalled",
		(COALESCE(github_orgs.issues_badged, 0) > 0) AS "githubIssueBadged"

	FROM creator_signups AS u
	LEFT JOIN oauth_logins AS github_logins ON github_logins.user_id = u.user_id AND github_logins.platform = 'github'
	LEFT JOIN oauth_logins AS google_logins ON google_logins.user_id = u.user_id AND google_logins.platform = 'google'
	LEFT JOIN products_created ON products_created.user_id = u.user_id
	LEFT JOIN user_pats ON user_pats.user_id = u.user_id
	LEFT JOIN github_orgs ON github_orgs.user_id = u.user_id
)
SELECT * FROM loops_csv;
