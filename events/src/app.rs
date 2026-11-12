use std::{sync::Arc, time::Duration};

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Request, State},
    http::{
        HeaderMap, StatusCode,
        header::{CONTENT_LENGTH, CONTENT_TYPE},
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::Utc;
use redis::aio::ConnectionManager;
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};

use crate::{
    auth::{AuthSettings, OrganizationAuth},
    event,
    ingest::{self, IngestError},
    telemetry,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_REQUEST_BODY_SIZE: usize = 10 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: ConnectionManager,
    pub auth: Arc<AuthSettings>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/v1/events/ingest", post(ingest))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_SIZE))
        .layer(middleware::from_fn(check_content_length))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(telemetry::request_span)
                .on_response(telemetry::record_response),
        )
        .route("/healthz", get(healthz))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::GATEWAY_TIMEOUT,
            REQUEST_TIMEOUT,
        ))
        .with_state(state)
}

async fn check_content_length(request: Request, next: Next) -> Response {
    let content_length = request.headers().get(CONTENT_LENGTH).map(|value| {
        value
            .to_str()
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
    });
    match content_length {
        None => error_response(
            StatusCode::LENGTH_REQUIRED,
            "LengthRequired",
            "A Content-Length header is required.",
        ),
        Some(Some(length)) if length > MAX_REQUEST_BODY_SIZE => error_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            "RequestBodyTooLarge",
            format!(
                "Request body exceeded the maximum allowed size of {MAX_REQUEST_BODY_SIZE} bytes."
            ),
        ),
        _ => next.run(request).await,
    }
}

pub fn error_response(status: StatusCode, error: &'static str, detail: impl Serialize) -> Response {
    (status, Json(json!({ "error": error, "detail": detail }))).into_response()
}

async fn ingest(
    State(state): State<AppState>,
    auth: OrganizationAuth,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, IngestError> {
    let events = event::parse_ingest(&body, is_json(&headers), Utc::now())
        .map_err(IngestError::InvalidPayload)?;

    let mut transaction = state.db.begin().await?;
    ingest::validate_references(&mut transaction, auth.organization_id, &events).await?;
    transaction.commit().await?;

    Ok(StatusCode::NOT_IMPLEMENTED.into_response())
}

fn is_json(headers: &HeaderMap) -> bool {
    headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .and_then(|media_type| {
            media_type
                .trim()
                .to_ascii_lowercase()
                .strip_prefix("application/")
                .map(str::to_owned)
        })
        .is_some_and(|subtype| subtype == "json" || subtype.ends_with("+json"))
}

async fn healthz(
    State(mut state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, &'static str)> {
    sqlx::query("SELECT 1")
        .execute(&state.db)
        .await
        .map_err(|error| {
            tracing::error!(%error, "database health check failed");
            (StatusCode::SERVICE_UNAVAILABLE, "Database is not available")
        })?;

    redis::cmd("PING")
        .query_async::<String>(&mut state.redis)
        .await
        .map_err(|error| {
            tracing::error!(%error, "redis health check failed");
            (StatusCode::SERVICE_UNAVAILABLE, "Redis is not available")
        })?;

    Ok(Json(json!({ "status": "ok" })))
}
