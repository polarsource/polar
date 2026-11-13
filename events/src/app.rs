use std::{net::SocketAddr, sync::Arc, time::Duration};

use anyhow::Context;
use aws_config::SdkConfig;
use axum::{
    Json, Router,
    body::Bytes,
    extract::{ConnectInfo, DefaultBodyLimit, Extension, Request, State},
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
use sqlx::{PgPool, Postgres, Transaction, postgres::PgPoolOptions};
use tokio::{
    sync::Semaphore,
    time::{Instant, MissedTickBehavior},
};
use tokio_util::task::TaskTracker;
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use tracing::{Instrument, field::Empty};
use uuid::Uuid;

use crate::{
    auth::{self, AuthSettings, OrganizationAuth},
    aws,
    client_ip::{self, TrustedProxies},
    config::Config,
    event::{self, EventCreate},
    hash_secrets::{self, HashSecrets},
    ingest::{self, IngestError, IngestResponse},
    jobs::{self, Job, SqsQueue, SqsSettings},
    outpost::{self, ReducerBucketChange},
    rate_limit::{self, RateLimiter},
    reducer::{self, ActiveBuckets},
    telemetry,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const WRITE_TIMEOUT: Duration = Duration::from_secs(25);
const STATEMENT_TIMEOUT: Duration = Duration::from_secs(10);
const DATABASE_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_BACKGROUND_TASKS: usize = 256;
const TRUE_CLIENT_IP: &str = "true-client-ip";
const X_FORWARDED_FOR: &str = "x-forwarded-for";
const HASH_SECRETS_REFRESH_INTERVAL: Duration = Duration::from_secs(60);
const MAX_REQUEST_BODY_SIZE: usize = 10 * 1024 * 1024;

#[derive(Clone, Copy)]
struct WriteDeadline(Instant);

#[derive(Clone)]
pub struct ClientIp(pub Option<String>);

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: ConnectionManager,
    pub redis_client: redis::Client,
    pub auth: Arc<AuthSettings>,
    pub tasks: TaskTracker,
    pub sqs: Option<Arc<SqsQueue>>,
    pub background: Arc<Semaphore>,
    pub rate_limiter: Arc<RateLimiter>,
    pub trusted_proxies: Arc<TrustedProxies>,
}

impl AppState {
    pub async fn connect(config: Config) -> anyhow::Result<Self> {
        let db = PgPoolOptions::new()
            .max_connections(config.postgres_pool_size)
            .acquire_timeout(DATABASE_ACQUIRE_TIMEOUT)
            .connect_with(config.postgres)
            .await
            .context("connecting to Postgres")?;
        let redis_client = redis::Client::open(config.redis_url)?;
        let redis = ConnectionManager::new(redis_client.clone())
            .await
            .context("connecting to Redis")?;
        let routes_to_sqs = |settings: &SqsSettings| {
            jobs::ACTORS.iter().any(|actor| {
                settings
                    .actors
                    .as_ref()
                    .is_none_or(|actors| actors.contains(*actor))
            })
        };
        let sdk_config = aws::sdk_config(&config.aws).await;
        let sqs = match config.worker_sqs {
            Some(settings) if routes_to_sqs(&settings) => Some(Arc::new(
                SqsQueue::connect(&sdk_config, settings)
                    .await
                    .context("connecting to SQS")?,
            )),
            _ => None,
        };
        let hash_secrets = match &config.hash_secret_arn {
            Some(arn) => hash_secrets::fetch(&sdk_config, arn, config.secret.clone(), None)
                .await
                .context("fetching the token hash secrets")?,
            None => HashSecrets {
                secrets: config.hash_secrets,
                legacy: config.secret.clone(),
            },
        };
        let auth = Arc::new(AuthSettings::new(hash_secrets, &config.base_url));
        if let Some(arn) = config.hash_secret_arn {
            tokio::spawn(refresh_hash_secrets(
                auth.clone(),
                sdk_config,
                arn,
                config.secret,
            ));
        }
        Ok(Self {
            sqs,
            background: Arc::new(Semaphore::new(MAX_BACKGROUND_TASKS)),
            rate_limiter: Arc::new(RateLimiter::new(&config.environment)),
            trusted_proxies: Arc::new(config.trusted_proxies),
            db,
            redis,
            redis_client,
            auth,
            tasks: TaskTracker::new(),
        })
    }
}

async fn refresh_hash_secrets(
    auth: Arc<AuthSettings>,
    sdk_config: SdkConfig,
    arn: String,
    fallback_legacy: String,
) {
    let mut interval = tokio::time::interval(HASH_SECRETS_REFRESH_INTERVAL);
    interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
    interval.tick().await;
    loop {
        interval.tick().await;
        match hash_secrets::fetch(&sdk_config, &arn, fallback_legacy.clone(), None).await {
            Ok(hash_secrets) => auth.replace_hash_secrets(hash_secrets),
            Err(error) => tracing::error!(
                error = format!("{error:#}"),
                "failed to refresh the token hash secrets"
            ),
        }
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/v1/events/ingest", post(ingest))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_SIZE))
        .layer(middleware::from_fn_with_state(state.clone(), limit_by_ip))
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

async fn check_content_length(mut request: Request, next: Next) -> Response {
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
        _ => {
            request
                .extensions_mut()
                .insert(WriteDeadline(Instant::now() + WRITE_TIMEOUT));
            next.run(request).await
        }
    }
}

fn client_ip(request: &Request, trusted_proxies: &TrustedProxies) -> Option<String> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
    };
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let forwarded_for = request
        .headers()
        .get_all(X_FORWARDED_FOR)
        .iter()
        .map(|value| {
            value
                .as_bytes()
                .iter()
                .map(|byte| char::from(*byte))
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join(", ");
    client_ip::resolve(
        header(TRUE_CLIENT_IP),
        Some(&forwarded_for),
        peer,
        trusted_proxies,
    )
}

async fn limit_by_ip(State(state): State<AppState>, mut request: Request, next: Next) -> Response {
    let ip = client_ip(&request, &state.trusted_proxies);
    request.extensions_mut().insert(ClientIp(ip.clone()));
    match state
        .rate_limiter
        .ip_retry_after(&mut state.redis.clone(), ip.as_deref())
        .await
    {
        Ok(0) => next.run(request).await,
        Ok(retry_after) => rate_limit::too_many_requests(retry_after),
        Err(error) => {
            tracing::error!(%error, "failed to check the IP rate limit");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub fn error_response(status: StatusCode, error: &'static str, detail: impl Serialize) -> Response {
    (status, Json(json!({ "error": error, "detail": detail }))).into_response()
}

async fn ingest(
    State(state): State<AppState>,
    auth: OrganizationAuth,
    Extension(deadline): Extension<WriteDeadline>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>, IngestError> {
    let events = event::parse_ingest(&body, is_json(&headers), Utc::now())
        .map_err(IngestError::InvalidPayload)?;
    if !auth.staged_events_ingest_enabled {
        return Err(IngestError::StagedIngestDisabled);
    }

    // A dropped connection or the request timeout cancels this handler: the write runs in its
    // own task so it never stops between the commit and handing off the bucket syncs.
    let response = state
        .tasks
        .clone()
        .spawn(
            store_events(
                state.clone(),
                auth.organization_id,
                auth.token_id,
                events,
                deadline,
            )
            .in_current_span(),
        )
        .await
        .map_err(IngestError::Interrupted)??;
    Ok(Json(response))
}

async fn store_events(
    state: AppState,
    organization_id: Uuid,
    token_id: Uuid,
    events: Vec<EventCreate>,
    WriteDeadline(deadline): WriteDeadline,
) -> Result<IngestResponse, IngestError> {
    // The deadline counts from the request's arrival and leaves the commit a margin before
    // the request times out. Redis only learns about events Postgres has committed.
    let written = tokio::time::timeout_at(deadline, write_events(&state, organization_id, &events))
        .await
        .map_err(|_| IngestError::TimedOut)??;
    written.transaction.commit().await?;
    auth::record_token_usage(&state, token_id);

    let mut redis = state.redis.clone();
    if let Some(active_buckets) = written.active_buckets {
        active_buckets.apply(&mut redis, organization_id).await;
    }
    let (tasks, background) = (state.tasks.clone(), state.background.clone());
    let response = written.response;
    let notify = async move {
        if let Err(error) = jobs::enqueue(state.sqs.as_deref(), &mut redis, written.sync_jobs).await
        {
            tracing::error!(
                error = format!("{error:#}"),
                "failed to enqueue reducer bucket syncs"
            );
        }
        outpost::publish(&mut redis, organization_id, &written.outpost_changes).await;
    }
    .instrument(telemetry::background_span("notify_reducer_changes"));
    // Sent in the background unless too much already is: then the request waits, and a slow
    // queue slows ingestion down instead of piling work up in memory.
    match background.try_acquire_owned() {
        Ok(permit) => {
            tasks.spawn(async move {
                notify.await;
                drop(permit);
            });
        }
        Err(_) => notify.await,
    }
    Ok(response)
}

struct WrittenEvents {
    transaction: Transaction<'static, Postgres>,
    response: IngestResponse,
    active_buckets: Option<ActiveBuckets>,
    sync_jobs: Vec<Job>,
    outpost_changes: Vec<ReducerBucketChange>,
}

async fn write_events(
    state: &AppState,
    organization_id: Uuid,
    events: &[EventCreate],
) -> Result<WrittenEvents, IngestError> {
    let mut transaction = state.db.begin().await?;
    // A statement stuck behind a bucket lock must not pin a pooled connection for long after
    // the write is abandoned.
    sqlx::query("SELECT set_config('statement_timeout', $1, true)")
        .bind(STATEMENT_TIMEOUT.as_millis().to_string())
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

    let (active_buckets, sync_jobs, outpost_changes) = if staged.inserted.is_empty() {
        (None, Vec::new(), Vec::new())
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
        (
            Some(rollup.active_buckets),
            rollup.sync_jobs,
            rollup.outpost_changes,
        )
    };
    Ok(WrittenEvents {
        response: IngestResponse {
            inserted: staged.inserted.len(),
            duplicates: staged.duplicates,
        },
        transaction,
        active_buckets,
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

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::HeaderValue};
    use tower::ServiceExt;

    use super::*;

    #[test]
    fn client_ip_matches_python_proxy_middleware() {
        #[derive(serde::Deserialize, Debug)]
        struct Case {
            trusted: String,
            peer: Option<std::net::IpAddr>,
            forwarded: Vec<String>,
            true_client: Option<String>,
            expected: Option<String>,
        }
        let cases: Vec<Case> =
            serde_json::from_str(include_str!("../tests/fixtures/client_ip_cases.json")).unwrap();
        for case in cases {
            let mut request = Request::new(Body::empty());
            for value in &case.forwarded {
                request
                    .headers_mut()
                    .append(X_FORWARDED_FOR, value.parse().unwrap());
            }
            if let Some(value) = &case.true_client {
                request
                    .headers_mut()
                    .insert(TRUE_CLIENT_IP, value.parse().unwrap());
            }
            if let Some(peer) = case.peer {
                request
                    .extensions_mut()
                    .insert(ConnectInfo(SocketAddr::new(peer, 1234)));
            }
            assert_eq!(
                client_ip(&request, &TrustedProxies::parse(&case.trusted).unwrap()),
                case.expected,
                "{case:?}",
            );
        }
    }

    #[tokio::test]
    #[ignore = "needs the local development database and Redis"]
    async fn records_token_usage_when_the_handler_is_dropped_during_the_write() {
        let mut config = Config::from_env().unwrap();
        config.postgres_pool_size = 1;
        config.worker_sqs = None;
        let state = AppState::connect(config).await.unwrap();
        let connection = state.db.acquire().await.unwrap();
        let token_id = Uuid::new_v4();
        let auth = OrganizationAuth {
            token_id,
            organization_id: Uuid::new_v4(),
            staged_events_ingest_enabled: true,
        };
        let mut request = Box::pin(ingest(
            State(state.clone()),
            auth,
            Extension(WriteDeadline(Instant::now() + WRITE_TIMEOUT)),
            HeaderMap::from_iter([(CONTENT_TYPE, HeaderValue::from_static("application/json"))]),
            Bytes::from_static(br#"{"events":[]}"#),
        ));
        tokio::select! {
            biased;
            _ = &mut request => panic!("the write must wait for a database connection"),
            () = std::future::ready(()) => {}
        }
        drop(request);
        drop(connection);
        state.tasks.close();
        state.tasks.wait().await;

        let mut redis = state.redis.clone();
        let messages: std::collections::HashMap<String, String> = redis::cmd("HGETALL")
            .arg("dramatiq:low_priority.DQ.msgs")
            .query_async(&mut redis)
            .await
            .unwrap();
        let messages: Vec<_> = messages
            .into_iter()
            .filter(|(_, encoded)| {
                let message: Value = serde_json::from_str(encoded).unwrap();
                message["actor_name"] == "organization_access_token.record_usage"
                    && message["kwargs"]["organization_access_token_id"] == token_id.to_string()
            })
            .collect();
        let mut cleanup = redis::pipe();
        for (message_id, _) in &messages {
            cleanup
                .hdel("dramatiq:low_priority.DQ.msgs", message_id)
                .lrem("dramatiq:low_priority.DQ", 0, message_id);
        }
        cleanup
            .del(format!(
                "debounce:organization_access_token.record_usage:{token_id}"
            ))
            .query_async::<()>(&mut redis)
            .await
            .unwrap();

        assert_eq!(messages.len(), 1);
    }

    #[tokio::test]
    #[ignore = "needs the local development database and Redis"]
    async fn limits_requests_without_a_token_by_client_ip() {
        let mut config = Config::from_env().unwrap();
        config.environment = "sandbox".to_owned();
        let state = AppState::connect(config).await.unwrap();
        let ip = format!("test-{}", Uuid::new_v4());
        let send = || {
            let request = axum::http::Request::post("/v1/events/ingest")
                .header(CONTENT_LENGTH, 2)
                .header(TRUE_CLIENT_IP, &ip)
                .body(Body::from("{}"))
                .unwrap();
            router(state.clone()).oneshot(request)
        };

        let mut statuses = Vec::new();
        for _ in 0..101 {
            statuses.push(send().await.unwrap().status());
        }
        let limited = send().await.unwrap();
        let retry_after = limited.headers().get("retry-after").cloned();
        let other_ip = format!("test-{}", Uuid::new_v4());
        let other_request = axum::http::Request::post("/v1/events/ingest")
            .header(CONTENT_LENGTH, 2)
            .header(TRUE_CLIENT_IP, &other_ip)
            .body(Body::from("{}"))
            .unwrap();
        let unlimited = router(state.clone()).oneshot(other_request).await.unwrap();
        let counted: bool = redis::cmd("EXISTS")
            .arg(format!("api:*:{ip}:minute"))
            .query_async(&mut state.redis.clone())
            .await
            .unwrap();
        let _: () = redis::cmd("DEL")
            .arg(format!("api:*:{ip}:minute"))
            .arg(format!("ip:*:ip:{ip}:second"))
            .arg(format!("api:*:{other_ip}:minute"))
            .arg(format!("ip:*:ip:{other_ip}:second"))
            .query_async(&mut state.redis.clone())
            .await
            .unwrap();

        assert!(
            statuses[..100]
                .iter()
                .all(|status| *status == StatusCode::UNAUTHORIZED)
        );
        assert_eq!(statuses[100], StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(limited.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(retry_after, Some(HeaderValue::from_static("60")));
        assert_eq!(unlimited.status(), StatusCode::UNAUTHORIZED);
        assert!(counted);
    }
}
