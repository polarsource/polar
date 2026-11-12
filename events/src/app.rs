use std::{sync::Arc, time::Duration};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use redis::aio::ConnectionManager;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};

use crate::{
    auth::{AuthSettings, OrganizationAuth},
    telemetry,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: ConnectionManager,
    pub auth: Arc<AuthSettings>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/v1/events/ingest", post(ingest))
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

async fn ingest(_auth: OrganizationAuth) -> StatusCode {
    StatusCode::NOT_IMPLEMENTED
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
