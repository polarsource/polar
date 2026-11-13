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
use sqlx::{PgPool, Postgres, Transaction};
use tokio_util::task::TaskTracker;
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use tracing::{Instrument, field::Empty};
use uuid::Uuid;

use crate::{
    auth::{AuthSettings, OrganizationAuth},
    event::{self, EventCreate},
    ingest::{self, IngestError, IngestResponse},
    jobs::{self, Job},
    outpost::{self, ReducerBucketChange},
    reducer, telemetry,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const WRITE_TIMEOUT: Duration = Duration::from_secs(25);
const MAX_REQUEST_BODY_SIZE: usize = 10 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: ConnectionManager,
    pub redis_client: redis::Client,
    pub auth: Arc<AuthSettings>,
    pub tasks: TaskTracker,
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
) -> Result<Json<IngestResponse>, IngestError> {
    let events = event::parse_ingest(&body, is_json(&headers), Utc::now())
        .map_err(IngestError::InvalidPayload)?;
    if !auth.staged_events_ingest_enabled {
        return Err(IngestError::StagedIngestDisabled);
    }

    // A dropped connection or the request timeout cancels this handler: the write runs in its
    // own task so it never stops between the commit and enqueueing the bucket syncs.
    state
        .tasks
        .clone()
        .spawn(store_events(state, auth.organization_id, events).in_current_span())
        .await
        .map_err(IngestError::Interrupted)?
        .map(Json)
}

async fn store_events(
    state: AppState,
    organization_id: Uuid,
    events: Vec<EventCreate>,
) -> Result<IngestResponse, IngestError> {
    // Everything up to the commit is abandoned before the request times out, so a client that
    // retries a timed out request never finds its first attempt stored after all.
    let written = tokio::time::timeout(
        WRITE_TIMEOUT,
        write_events(&state, organization_id, &events),
    )
    .await
    .map_err(|_| IngestError::TimedOut)??;
    written.transaction.commit().await?;

    if let Err(error) = jobs::enqueue(&mut state.redis.clone(), written.sync_jobs).await {
        tracing::error!(%error, "failed to enqueue reducer bucket syncs");
    }
    outpost::publish(
        &mut state.redis.clone(),
        organization_id,
        &written.outpost_changes,
    )
    .await;
    Ok(written.response)
}

struct WrittenEvents {
    transaction: Transaction<'static, Postgres>,
    response: IngestResponse,
    sync_jobs: Vec<Job>,
    outpost_changes: Vec<ReducerBucketChange>,
}

async fn write_events(
    state: &AppState,
    organization_id: Uuid,
    events: &[EventCreate],
) -> Result<WrittenEvents, IngestError> {
    let mut transaction = state.db.begin().await?;
    // Waiting on a bucket lock must not outlive the request and pin a pooled connection.
    sqlx::query("SELECT set_config('statement_timeout', $1, true)")
        .bind(WRITE_TIMEOUT.as_millis().to_string())
        .execute(&mut *transaction)
        .await?;
    ingest::validate_references(&mut transaction, organization_id, events).await?;
    let event_types =
        ingest::resolve_event_types(&mut transaction, organization_id, events).await?;
    let staged =
        ingest::insert_staged_events(&mut transaction, organization_id, events, &event_types)
            .await?;
    let request_span = tracing::Span::current();
    request_span.record("inserted_events", staged.inserted.len());
    request_span.record("skipped_duplicates", staged.duplicates);

    let (sync_jobs, outpost_changes) = if staged.inserted.is_empty() {
        (Vec::new(), Vec::new())
    } else {
        let span = tracing::info_span!(
            "rollup_reducer_buckets",
            organization_count = 1,
            event_count = staged.inserted.len(),
            rolled_up_buckets = Empty,
        );
        let rollup = reducer::rollup(
            &mut transaction,
            &state.redis_client,
            &mut state.redis.clone(),
            organization_id,
            &staged.inserted,
            Utc::now(),
        )
        .instrument(span.clone())
        .await?;
        span.record("rolled_up_buckets", rollup.bucket_count);
        (rollup.sync_jobs, rollup.outpost_changes)
    };
    Ok(WrittenEvents {
        response: IngestResponse {
            inserted: staged.inserted.len(),
            duplicates: staged.duplicates,
        },
        transaction,
        sync_jobs,
        outpost_changes,
    })
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
            telemetry::log_database_error(&error, "health check");
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
