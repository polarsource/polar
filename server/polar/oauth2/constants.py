AUTHORIZATION_CODE_PREFIX = "polar_ac_"
ACCESS_TOKEN_PREFIX = "polar_at_"
REFRESH_TOKEN_PREFIX = "polar_rt_"

ISSUER = "https://polar.sh"
SERVICE_DOCUMENTATION = "https://docs.polar.sh"
SUBJECT_TYPES_SUPPORTED = ["public"]
ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED = ["RS256"]
CLAIMS_SUPPORTED = ["sub", "name", "email", "email_verified"]

SCOPES_SUPPORTED = ["openid", "profile", "email"]
SCOPES_SUPPORTED_DISPLAY_NAMES: dict[str, str] = {
    "openid": "OpenID",
    "profile": "Profile",
    "email": "Email",
}
