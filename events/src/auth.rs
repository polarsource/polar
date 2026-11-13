use std::{
    fmt::Write,
    sync::{Arc, PoisonError, RwLock},
    time::SystemTime,
};

use axum::{
    Json,
    extract::FromRequestParts,
    http::{
        HeaderMap, HeaderValue, StatusCode,
        header::{AUTHORIZATION, CACHE_CONTROL, PRAGMA, WWW_AUTHENTICATE},
        request::Parts,
    },
    response::{IntoResponse, Response},
};
use ring::hmac;
use serde_json::json;
use tracing::Instrument;
use uuid::Uuid;

use crate::{
    app::{AppState, ClientIp, error_response},
    hash_secrets::HashSecrets,
    jobs,
    jobs::Job,
    rate_limit, telemetry,
};

const TOKEN_PREFIX: &str = "polar_oat_";
const REQUIRED_SCOPE: &str = "events:write";
const ORGANIZATION_HEADER: &str = "polar-organization";
const REALM: &str = "polar";
const HASH_SEPARATOR: char = '$';
const INVALID_TOKEN_DESCRIPTION: &str =
    "The access token provided is expired, revoked, malformed, or invalid for other reasons.";
const INSUFFICIENT_SCOPE_DESCRIPTION: &str =
    "The request requires higher privileges than provided by the access token.";

pub struct AuthSettings {
    hash_secrets: RwLock<Arc<HashSecrets>>,
    resource_metadata_url: String,
}

impl AuthSettings {
    pub fn new(hash_secrets: HashSecrets, base_url: &str) -> Self {
        Self {
            hash_secrets: RwLock::new(Arc::new(hash_secrets)),
            resource_metadata_url: format!("{base_url}/.well-known/oauth-protected-resource"),
        }
    }

    pub fn replace_hash_secrets(&self, hash_secrets: HashSecrets) {
        *self
            .hash_secrets
            .write()
            .unwrap_or_else(PoisonError::into_inner) = Arc::new(hash_secrets);
    }

    fn token_hash_candidates(&self, token: &str) -> Vec<String> {
        let hash_secrets = self
            .hash_secrets
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone();
        hash_secrets
            .secrets
            .iter()
            .map(|(id, secret)| format!("{id}{HASH_SEPARATOR}{}", digest(token, secret)))
            .chain([digest(token, &hash_secrets.legacy)])
            .collect()
    }
}

fn digest(token: &str, secret: &str) -> String {
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
    hmac::sign(&key, token.as_bytes())
        .as_ref()
        .iter()
        .fold(String::new(), |mut hex, byte| {
            write!(hex, "{byte:02x}").expect("writing to a String cannot fail");
            hex
        })
}

pub struct OrganizationAuth {
    pub token_id: Uuid,
    pub organization_id: Uuid,
    pub staged_events_ingest_enabled: bool,
}

#[derive(Debug)]
enum AuthError {
    Unauthorized,
    InvalidToken,
    InsufficientScope,
    InvalidRequestedOrganization,
    RequestedOrganizationNotAccessible,
    RateLimited(u64),
    RateLimiter(redis::RedisError),
    Database(sqlx::Error),
}

impl FromRequestParts<AppState> for OrganizationAuth {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        let client_ip = parts.extensions.get::<ClientIp>().cloned();
        authenticate(&parts.headers, client_ip.as_ref(), state)
            .await
            .map_err(|error| error.into_response(&state.auth))
    }
}

async fn authenticate(
    headers: &HeaderMap,
    client_ip: Option<&ClientIp>,
    state: &AppState,
) -> Result<OrganizationAuth, AuthError> {
    let Some(token) = bearer_token(headers) else {
        let ip = client_ip.and_then(|ClientIp(ip)| ip.as_deref());
        return Err(
            match state
                .rate_limiter
                .anonymous_retry_after(&mut state.redis.clone(), ip)
                .await
            {
                Ok(0) => AuthError::Unauthorized,
                Ok(retry_after) => AuthError::RateLimited(retry_after),
                Err(error) => AuthError::RateLimiter(error),
            },
        );
    };
    if !token.starts_with(TOKEN_PREFIX) {
        return Err(AuthError::InvalidToken);
    }

    let (token_id, scope, organization_id, staged_events_ingest_enabled, rate_limit_group): (
        Uuid,
        String,
        Uuid,
        bool,
        String,
    ) = sqlx::query_as(
        "SELECT organization_access_tokens.id, organization_access_tokens.scope, organizations.id, \
         COALESCE(organizations.feature_settings -> 'staged_events_ingest_enabled' = 'true', false), \
         organizations.rate_limit_group \
         FROM organization_access_tokens \
         JOIN organizations ON organizations.id = organization_access_tokens.organization_id \
         WHERE organization_access_tokens.deleted_at IS NULL \
         AND organization_access_tokens.token_v2 = ANY($1) \
         AND organizations.deleted_at IS NULL \
         AND CAST((organizations.capabilities ->> 'api_access') AS BOOLEAN) \
         AND (organization_access_tokens.expires_at IS NULL \
              OR organization_access_tokens.expires_at > now())",
    )
    .bind(state.auth.token_hash_candidates(token))
    .fetch_optional(&state.db)
    .await
    .map_err(AuthError::Database)?
    .ok_or(AuthError::InvalidToken)?;

    if let Some(requested) = headers.get(ORGANIZATION_HEADER) {
        let requested = requested
            .to_str()
            .ok()
            .and_then(|value| Uuid::parse_str(value).ok())
            .ok_or(AuthError::InvalidRequestedOrganization)?;
        if requested != organization_id {
            return Err(AuthError::RequestedOrganizationNotAccessible);
        }
    }

    match state
        .rate_limiter
        .organization_retry_after(&mut state.redis.clone(), organization_id, &rate_limit_group)
        .await
    {
        Ok(0) => {}
        Ok(retry_after) => {
            record_token_usage(state, token_id);
            return Err(AuthError::RateLimited(retry_after));
        }
        Err(error) => return Err(AuthError::RateLimiter(error)),
    }

    if !scope
        .split_whitespace()
        .any(|scope| scope == REQUIRED_SCOPE)
    {
        return Err(AuthError::InsufficientScope);
    }

    let span = tracing::Span::current();
    span.record("subject_type", "Organization");
    span.record("subject_id", organization_id.to_string());

    Ok(OrganizationAuth {
        token_id,
        organization_id,
        staged_events_ingest_enabled,
    })
}

pub fn record_token_usage(state: &AppState, token_id: Uuid) {
    let Ok(permit) = state.background.clone().try_acquire_owned() else {
        return;
    };
    let usage = Job::record_organization_access_token_usage(token_id, SystemTime::now());
    let (sqs, mut redis) = (state.sqs.clone(), state.redis.clone());
    state.tasks.spawn(
        async move {
            if let Err(error) = jobs::enqueue(sqs.as_deref(), &mut redis, vec![usage]).await {
                tracing::warn!(
                    error = format!("{error:#}"),
                    "failed to enqueue organization access token usage"
                );
            }
            drop(permit);
        }
        .instrument(telemetry::background_span("record_token_usage")),
    );
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let (scheme, value) = headers.get(AUTHORIZATION)?.to_str().ok()?.split_once(' ')?;
    let value = value.trim();
    (scheme.eq_ignore_ascii_case("bearer") && !value.is_empty()).then_some(value)
}

impl AuthError {
    fn into_response(self, settings: &AuthSettings) -> Response {
        let resource_metadata = &settings.resource_metadata_url;
        match self {
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                [(
                    WWW_AUTHENTICATE,
                    challenge(format!(
                        r#"realm="{REALM}", resource_metadata="{resource_metadata}""#
                    )),
                )],
                Json(json!({ "error": "Unauthorized", "detail": "Unauthorized" })),
            )
                .into_response(),
            Self::InvalidToken => oauth2_error(
                StatusCode::UNAUTHORIZED,
                "invalid_token",
                INVALID_TOKEN_DESCRIPTION,
                format!(r#"realm="{REALM}", resource_metadata="{resource_metadata}""#),
            ),
            Self::InsufficientScope => oauth2_error(
                StatusCode::FORBIDDEN,
                "insufficient_scope",
                INSUFFICIENT_SCOPE_DESCRIPTION,
                format!(r#"realm="{REALM}", scope="{REQUIRED_SCOPE}""#),
            ),
            Self::InvalidRequestedOrganization => error_response(
                StatusCode::BAD_REQUEST,
                "InvalidRequestedOrganization",
                "The Polar-Organization header must be an organization ID.",
            ),
            Self::RequestedOrganizationNotAccessible => error_response(
                StatusCode::FORBIDDEN,
                "RequestedOrganizationNotAccessible",
                "The organization in the Polar-Organization header \
                 is not accessible with this credential.",
            ),
            Self::RateLimited(retry_after) => rate_limit::too_many_requests(retry_after),
            Self::RateLimiter(error) => {
                tracing::error!(%error, "failed to check the rate limit");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
            Self::Database(error) => {
                telemetry::log_database_error(&error, "organization access token lookup");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
        }
    }
}

fn challenge(attributes: String) -> HeaderValue {
    HeaderValue::try_from(format!("Bearer {attributes}"))
        .unwrap_or(HeaderValue::from_static("Bearer"))
}

fn oauth2_error(
    status: StatusCode,
    error: &'static str,
    description: &'static str,
    attributes: String,
) -> Response {
    (
        status,
        [
            (CACHE_CONTROL, HeaderValue::from_static("no-store")),
            (PRAGMA, HeaderValue::from_static("no-cache")),
            (
                WWW_AUTHENTICATE,
                challenge(format!(
                    r#"{attributes}, error="{error}", error_description="{description}""#
                )),
            ),
        ],
        Json(json!({ "error": error, "error_description": description })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    fn headers(authorization: &str) -> HeaderMap {
        HeaderMap::from_iter([(AUTHORIZATION, HeaderValue::from_str(authorization).unwrap())])
    }

    #[test]
    fn extracts_bearer_tokens() {
        assert_eq!(
            bearer_token(&headers("Bearer polar_oat_abc")),
            Some("polar_oat_abc")
        );
        assert_eq!(
            bearer_token(&headers("bearer  polar_oat_abc ")),
            Some("polar_oat_abc")
        );
        assert_eq!(bearer_token(&headers("Basic polar_oat_abc")), None);
        assert_eq!(bearer_token(&headers("Bearer")), None);
        assert_eq!(bearer_token(&HeaderMap::new()), None);
    }

    #[test]
    fn hashes_tokens_like_the_python_server() {
        let settings = AuthSettings::new(
            HashSecrets {
                secrets: HashMap::from([("v2".to_owned(), "other".to_owned())]),
                legacy: "super secret jwt secret".to_owned(),
            },
            "http://127.0.0.1:8000",
        );

        assert_eq!(
            settings.token_hash_candidates("polar_oat_abc"),
            [
                "v2$3d9b3be3d800c653b5c7397d66099ccbbcb4947eb841ae56e3b0eabeebd0c28b",
                "6546f3cb0075567f38939cbc50d2f853b3eca875c4d74fee390a6795c9c48d1c",
            ]
        );
    }

    #[test]
    fn challenges_name_the_missing_scope() {
        let settings = AuthSettings::new(
            HashSecrets {
                secrets: HashMap::new(),
                legacy: String::new(),
            },
            "http://127.0.0.1:8000",
        );

        let response = AuthError::InsufficientScope.into_response(&settings);

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(
            response.headers()[WWW_AUTHENTICATE],
            "Bearer realm=\"polar\", scope=\"events:write\", error=\"insufficient_scope\", \
             error_description=\"The request requires higher privileges than provided by the access token.\""
        );
    }
}
