use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
    time::Duration,
};

use chrono::Utc;
use redis::aio::ConnectionManager;
use sqlx::{PgPool, Postgres, SqlSafeStr, Transaction};
use tokio::{
    sync::{Mutex, Semaphore, mpsc, oneshot},
    time::Instant,
};
use tokio_util::task::TaskTracker;
use tracing::{Instrument, field::Empty};
use uuid::Uuid;

use crate::{
    event::EventCreate,
    ingest::{self, IngestError, IngestResponse, StagingRequest},
    outpost,
    reducer::{self, ActiveReducers, Rollup},
    telemetry,
};

const QUEUE_CAPACITY: usize = 10_000;
const MAX_QUEUE_WAIT: Duration = Duration::from_secs(1);
const MAX_BATCH_EVENTS: usize = 1_000;
const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(1);
const BEGIN_WITH_STATEMENT_TIMEOUT: &str = "BEGIN; SET LOCAL statement_timeout = 10000";

pub struct Submission {
    pub organization_id: Uuid,
    pub events: Vec<EventCreate>,
    pub event_types: HashMap<String, Uuid>,
    pub reducers: ActiveReducers,
    pub deadline: Instant,
}

struct Queued {
    submission: Submission,
    queued_at: Instant,
    reply: oneshot::Sender<Result<IngestResponse, IngestError>>,
}

type Queue = Arc<Mutex<mpsc::Receiver<Queued>>>;

#[derive(Clone)]
pub struct Batcher(mpsc::Sender<Queued>);

#[derive(Clone)]
pub struct Writer {
    pub db: PgPool,
    pub redis: ConnectionManager,
    pub tasks: TaskTracker,
    pub background: Arc<Semaphore>,
}

struct Stored {
    transaction: Transaction<'static, Postgres>,
    responses: Vec<IngestResponse>,
    rollups: Vec<(Uuid, Rollup)>,
}

impl Batcher {
    pub fn start(writers: u32, writer: Writer) -> Self {
        let (sender, receiver) = mpsc::channel(QUEUE_CAPACITY);
        let queue = Arc::new(Mutex::new(receiver));
        for _ in 0..writers.max(1) {
            tokio::spawn(writer.clone().run(queue.clone()));
        }
        Self(sender)
    }

    pub async fn submit(&self, submission: Submission) -> Result<IngestResponse, IngestError> {
        let (reply, written) = oneshot::channel();
        self.0
            .try_send(Queued {
                submission,
                queued_at: Instant::now(),
                reply,
            })
            .map_err(|_| IngestError::Overloaded)?;
        written.await.unwrap_or(Err(IngestError::WriteFailed))
    }
}

async fn next_batch(queue: &Queue) -> Option<Vec<Queued>> {
    let mut queue = queue.lock().await;
    let first = queue.recv().await?;
    let mut event_count = first.submission.events.len();
    let mut batch = vec![first];
    while event_count < MAX_BATCH_EVENTS {
        let Ok(next) = queue.try_recv() else {
            break;
        };
        event_count += next.submission.events.len();
        batch.push(next);
    }
    Some(batch)
}

impl Writer {
    async fn run(self, queue: Queue) {
        while let Some(batch) = next_batch(&queue).await {
            let now = Instant::now();
            let mut waiting = Vec::with_capacity(batch.len());
            for queued in batch {
                if queued.submission.deadline <= now {
                    let _ = queued.reply.send(Err(IngestError::TimedOut));
                } else if now.duration_since(queued.queued_at) > MAX_QUEUE_WAIT {
                    let _ = queued.reply.send(Err(IngestError::Overloaded));
                } else {
                    waiting.push(queued);
                }
            }
            if waiting.is_empty() {
                continue;
            }
            let span = tracing::info_span!(
                parent: None,
                "write_batch",
                request_count = waiting.len(),
                event_count = waiting
                    .iter()
                    .map(|queued| queued.submission.events.len())
                    .sum::<usize>(),
            );
            self.write(waiting).instrument(span).await;
        }
    }

    async fn write(&self, batch: Vec<Queued>) {
        let outcome = async {
            let submissions = Vec::from_iter(batch.iter().map(|queued| &queued.submission));
            // Nothing is stored once a request in the batch has been told its write timed out.
            let deadline = submissions
                .iter()
                .map(|submission| submission.deadline)
                .min()
                .expect("a batch holds at least one request");
            let stored = tokio::time::timeout_at(deadline, self.store(&submissions))
                .await
                .map_err(|_| IngestError::TimedOut)??;
            stored
                .transaction
                .commit()
                .instrument(tracing::info_span!("commit"))
                .await?;
            Ok::<_, IngestError>((stored.responses, stored.rollups))
        }
        .await;

        let (responses, rollups) = match outcome {
            Ok(stored) => stored,
            Err(error) => {
                let reply: fn() -> IngestError = match &error {
                    IngestError::Overloaded => || IngestError::Overloaded,
                    IngestError::TimedOut => || IngestError::TimedOut,
                    IngestError::Database(error) => {
                        telemetry::log_database_error(error, "event ingestion");
                        || IngestError::WriteFailed
                    }
                    _ => {
                        tracing::error!("event batch could not be written");
                        || IngestError::WriteFailed
                    }
                };
                for queued in batch {
                    let _ = queued.reply.send(Err(reply()));
                }
                return;
            }
        };

        // The Redis buckets only learn about events Postgres has committed, and before the
        // requests are answered. The notification is handed off first too: the requests keep
        // the shutdown waiting until it is tracked.
        let mut redis = self.redis.clone();
        let mut outpost_changes = Vec::with_capacity(rollups.len());
        for (organization_id, rollup) in rollups {
            rollup
                .active_buckets
                .apply(&mut redis, organization_id)
                .instrument(tracing::info_span!("update_active_buckets"))
                .await;
            outpost_changes.push((organization_id, rollup.outpost_changes));
        }
        let notify = async move {
            for (organization_id, changes) in outpost_changes {
                outpost::publish(&mut redis, organization_id, &changes).await;
            }
        }
        .instrument(telemetry::background_span("notify_reducer_changes"));
        // Sent in the background unless too much already is: then the writer waits, and a slow
        // Redis slows ingestion down instead of piling work up in memory.
        match self.background.clone().try_acquire_owned() {
            Ok(permit) => {
                self.tasks.spawn(async move {
                    notify.await;
                    drop(permit);
                });
            }
            Err(_) => notify.await,
        }
        for (queued, response) in batch.into_iter().zip(responses) {
            let _ = queued.reply.send(Ok(response));
        }
    }

    async fn store(&self, submissions: &[&Submission]) -> Result<Stored, IngestError> {
        let connection = tokio::time::timeout(ACQUIRE_TIMEOUT, self.db.acquire())
            .instrument(tracing::info_span!("acquire_connection"))
            .await
            .map_err(|_| IngestError::Overloaded)??;
        // A statement stuck behind a bucket lock must not pin a pooled connection for long
        // after the write is abandoned.
        let mut transaction = Transaction::begin(
            connection,
            Some(BEGIN_WITH_STATEMENT_TIMEOUT.into_sql_str()),
        )
        .instrument(tracing::info_span!("begin"))
        .await?;
        let requests = Vec::from_iter(submissions.iter().map(|submission| StagingRequest {
            organization_id: submission.organization_id,
            events: &submission.events,
            event_types: &submission.event_types,
        }));
        let staged = ingest::insert_staged_events(&mut transaction, &requests)
            .instrument(tracing::info_span!("insert_staged_events"))
            .await?;

        // One rollup per organization, in a fixed order, so every batch takes locks alike.
        let mut inserted: BTreeMap<Uuid, (&ActiveReducers, Vec<&EventCreate>)> = BTreeMap::new();
        for (submission, staged) in submissions.iter().zip(&staged) {
            if !staged.inserted.is_empty() {
                inserted
                    .entry(submission.organization_id)
                    .or_insert_with(|| (&submission.reducers, Vec::new()))
                    .1
                    .extend(staged.inserted.iter().copied());
            }
        }
        let span = tracing::info_span!(
            "rollup_reducer_buckets",
            organization_count = inserted.len(),
            event_count = inserted
                .values()
                .map(|(_, events)| events.len())
                .sum::<usize>(),
            rolled_up_buckets = Empty,
        );
        let now = Utc::now();
        let mut rollups = Vec::with_capacity(inserted.len());
        let mut bucket_count = 0;
        for (organization_id, (reducers, events)) in &inserted {
            let rollup = reducer::rollup(&mut transaction, *organization_id, reducers, events, now)
                .instrument(span.clone())
                .await?;
            bucket_count += rollup.bucket_count;
            rollups.push((*organization_id, rollup));
        }
        span.record("rolled_up_buckets", bucket_count);

        Ok(Stored {
            responses: Vec::from_iter(staged.iter().map(|staged| IngestResponse {
                inserted: staged.inserted.len(),
                duplicates: staged.duplicates,
            })),
            transaction,
            rollups,
        })
    }
}
