use std::{
    collections::{BTreeSet, HashMap},
    str::FromStr,
};

use chrono::{DateTime, TimeDelta, Utc};
use sqlx::{PgConnection, types::BigDecimal};
use uuid::Uuid;

use super::{
    BUCKET_SIZE_SECONDS, BucketId, Reducer, TimedValues, bucket_start, bucket_start_datetime,
    filter::Aggregation, redis_store::bucket_key,
};

const LOCK_NAMESPACE: &str = "reducer_bucket.buckets";

#[derive(Debug)]
struct StoredBucket {
    id: Uuid,
    reducer_id: Uuid,
    customer_id: Option<Uuid>,
    external_customer_id: Option<String>,
    bucket_start: DateTime<Utc>,
    bucket_end: DateTime<Utc>,
    generation: i32,
    sealed_at: Option<DateTime<Utc>>,
}

#[derive(Debug)]
struct Totals {
    count: i64,
    sum: BigDecimal,
    min: Option<BigDecimal>,
    max: Option<BigDecimal>,
}

#[derive(Debug)]
enum Write<'a> {
    Addition {
        bucket_id: Uuid,
        totals: Totals,
    },
    NewBucket {
        reducer_id: Uuid,
        customer_id: Option<Uuid>,
        external_customer_id: Option<&'a str>,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        generation: i32,
        totals: Totals,
    },
}

pub(super) async fn add_to_closed_buckets(
    connection: &mut PgConnection,
    organization_id: Uuid,
    reducers: &[Reducer],
    closed: Vec<(&BucketId<'_>, &TimedValues)>,
) -> Result<(), sqlx::Error> {
    if closed.is_empty() {
        return Ok(());
    }
    // Locks are taken in one global order before any row is written, like the seal does, so
    // neither can deadlock the other.
    let mut closed = Vec::from_iter(closed.into_iter().map(|(bucket, values)| {
        (
            bucket_key(reducers[bucket.reducer].id, bucket),
            bucket,
            values,
        )
    }));
    closed.sort_by(|(key, ..), (other, ..)| key.cmp(other));
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtextextended(lock_key, 0)) \
         FROM UNNEST($1::text[]) AS lock_key",
    )
    .bind(Vec::from_iter(
        closed
            .iter()
            .map(|(key, ..)| format!("{LOCK_NAMESPACE}:{key}")),
    ))
    .execute(&mut *connection)
    .await?;
    let closed = Vec::from_iter(
        closed
            .into_iter()
            .map(|(_, bucket, values)| (bucket, values)),
    );

    // One statement per identity shape keeps every predicate an equality the identity index
    // serves; a NULL-safe comparison would scan the organization's buckets.
    let by_customer = Vec::from_iter(
        closed
            .iter()
            .map(|(bucket, _)| *bucket)
            .filter(|bucket| bucket.customer_id.is_some()),
    );
    let by_external_customer = Vec::from_iter(
        closed
            .iter()
            .map(|(bucket, _)| *bucket)
            .filter(|bucket| bucket.customer_id.is_none()),
    );
    let reducer_ids = |slots: &[&BucketId]| {
        Vec::from_iter(slots.iter().map(|bucket| reducers[bucket.reducer].id))
    };
    let slot_starts = |slots: &[&BucketId]| {
        Vec::from_iter(
            slots
                .iter()
                .map(|bucket| bucket_start_datetime(bucket.start)),
        )
    };
    let mut stored: Vec<StoredRow> = Vec::new();
    if !by_customer.is_empty() {
        stored.extend(
            sqlx::query_as(
                "SELECT reducer_buckets.id, reducer_buckets.reducer_id, \
                     reducer_buckets.customer_id, reducer_buckets.external_customer_id, \
                     reducer_buckets.bucket_start, reducer_buckets.bucket_end, \
                     reducer_buckets.generation, reducer_buckets.sealed_at \
                 FROM reducer_buckets \
                 JOIN UNNEST($2::uuid[], $3::timestamptz[], $4::uuid[]) \
                     AS slot (reducer_id, slot_start, customer_id) \
                     ON reducer_buckets.reducer_id = slot.reducer_id \
                     AND reducer_buckets.customer_id = slot.customer_id \
                     AND reducer_buckets.bucket_start >= slot.slot_start \
                     AND reducer_buckets.bucket_start < slot.slot_start + $5::interval \
                 WHERE reducer_buckets.organization_id = $1 \
                     AND reducer_buckets.external_customer_id IS NULL \
                 FOR UPDATE OF reducer_buckets",
            )
            .bind(organization_id)
            .bind(reducer_ids(&by_customer))
            .bind(slot_starts(&by_customer))
            .bind(Vec::from_iter(
                by_customer.iter().map(|bucket| bucket.customer_id),
            ))
            .bind(TimeDelta::seconds(BUCKET_SIZE_SECONDS))
            .fetch_all(&mut *connection)
            .await?,
        );
    }
    if !by_external_customer.is_empty() {
        stored.extend(
            sqlx::query_as(
                "SELECT reducer_buckets.id, reducer_buckets.reducer_id, \
                     reducer_buckets.customer_id, reducer_buckets.external_customer_id, \
                     reducer_buckets.bucket_start, reducer_buckets.bucket_end, \
                     reducer_buckets.generation, reducer_buckets.sealed_at \
                 FROM reducer_buckets \
                 JOIN UNNEST($2::uuid[], $3::timestamptz[], $4::text[]) \
                     AS slot (reducer_id, slot_start, external_customer_id) \
                     ON reducer_buckets.reducer_id = slot.reducer_id \
                     AND reducer_buckets.external_customer_id = slot.external_customer_id \
                     AND reducer_buckets.bucket_start >= slot.slot_start \
                     AND reducer_buckets.bucket_start < slot.slot_start + $5::interval \
                 WHERE reducer_buckets.organization_id = $1 \
                     AND reducer_buckets.customer_id IS NULL \
                 FOR UPDATE OF reducer_buckets",
            )
            .bind(organization_id)
            .bind(reducer_ids(&by_external_customer))
            .bind(slot_starts(&by_external_customer))
            .bind(Vec::from_iter(
                by_external_customer
                    .iter()
                    .map(|bucket| bucket.external_customer_id),
            ))
            .bind(TimeDelta::seconds(BUCKET_SIZE_SECONDS))
            .fetch_all(&mut *connection)
            .await?,
        );
    }
    let stored = Vec::from_iter(stored.into_iter().map(
        |(
            id,
            reducer_id,
            customer_id,
            external_customer_id,
            bucket_start,
            bucket_end,
            generation,
            sealed_at,
        )| StoredBucket {
            id,
            reducer_id,
            customer_id,
            external_customer_id,
            bucket_start,
            bucket_end,
            generation,
            sealed_at,
        },
    ));

    let now = Utc::now();
    let mut additions = (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
    let mut reducer_ids = Vec::new();
    let mut customer_ids = Vec::new();
    let mut external_customer_ids = Vec::new();
    let mut starts = Vec::new();
    let mut ends = Vec::new();
    let mut generations = Vec::new();
    let mut created = (Vec::new(), Vec::new(), Vec::new(), Vec::new());
    for write in plan_writes(reducers, &closed, &stored) {
        match write {
            Write::Addition { bucket_id, totals } => {
                additions.0.push(bucket_id);
                additions.1.push(totals.count);
                additions.2.push(totals.sum);
                additions.3.push(totals.min);
                additions.4.push(totals.max);
            }
            Write::NewBucket {
                reducer_id,
                customer_id,
                external_customer_id,
                start,
                end,
                generation,
                totals,
            } => {
                reducer_ids.push(reducer_id);
                customer_ids.push(customer_id);
                external_customer_ids.push(external_customer_id);
                starts.push(start);
                ends.push(end);
                generations.push(generation);
                created.0.push(totals.count);
                created.1.push(totals.sum);
                created.2.push(totals.min);
                created.3.push(totals.max);
            }
        }
    }

    if !additions.0.is_empty() {
        sqlx::query(
            "UPDATE reducer_buckets SET \
                 count = reducer_buckets.count + added.count, \
                 sum = reducer_buckets.sum + added.sum, \
                 min = LEAST(reducer_buckets.min, added.min), \
                 max = GREATEST(reducer_buckets.max, added.max), \
                 modified_at = $6 \
             FROM UNNEST($1::uuid[], $2::bigint[], $3::numeric[], $4::numeric[], $5::numeric[]) \
                 AS added (id, count, sum, min, max) \
             WHERE reducer_buckets.id = added.id",
        )
        .bind(additions.0)
        .bind(additions.1)
        .bind(additions.2)
        .bind(additions.3)
        .bind(additions.4)
        .bind(now)
        .execute(&mut *connection)
        .await?;
    }
    if !reducer_ids.is_empty() {
        sqlx::query(
            "INSERT INTO reducer_buckets (\
                 id, created_at, organization_id, reducer_id, customer_id, external_customer_id, \
                 bucket_start, bucket_end, count, sum, min, max, generation\
             ) \
             SELECT new.id, $2, $1, new.reducer_id, new.customer_id, new.external_customer_id, \
                 new.bucket_start, new.bucket_end, new.count, new.sum, new.min, new.max, \
                 new.generation \
             FROM UNNEST(\
                 $3::uuid[], $4::uuid[], $5::uuid[], $6::text[], $7::timestamptz[], \
                 $8::timestamptz[], $9::bigint[], $10::numeric[], $11::numeric[], \
                 $12::numeric[], $13::integer[]\
             ) AS new (\
                 id, reducer_id, customer_id, external_customer_id, bucket_start, bucket_end, \
                 count, sum, min, max, generation\
             )",
        )
        .bind(organization_id)
        .bind(now)
        .bind(Vec::from_iter(reducer_ids.iter().map(|_| Uuid::new_v4())))
        .bind(reducer_ids)
        .bind(customer_ids)
        .bind(external_customer_ids)
        .bind(starts)
        .bind(ends)
        .bind(created.0)
        .bind(created.1)
        .bind(created.2)
        .bind(created.3)
        .bind(generations)
        .execute(&mut *connection)
        .await?;
    }
    Ok(())
}

type StoredRow = (
    Uuid,
    Uuid,
    Option<Uuid>,
    Option<String>,
    DateTime<Utc>,
    DateTime<Utc>,
    i32,
    Option<DateTime<Utc>>,
);

fn plan_writes<'a>(
    reducers: &[Reducer],
    closed: &[(&BucketId<'a>, &TimedValues)],
    stored: &[StoredBucket],
) -> Vec<Write<'a>> {
    let mut slots: HashMap<_, Vec<&StoredBucket>> = HashMap::new();
    for stored in stored {
        slots
            .entry((
                stored.reducer_id,
                bucket_start(stored.bucket_start.timestamp()),
                stored.customer_id,
                stored.external_customer_id.as_deref(),
            ))
            .or_default()
            .push(stored);
    }

    let mut writes = Vec::new();
    for (bucket, contributions) in closed {
        let reducer = &reducers[bucket.reducer];
        let slot = slots
            .get(&(
                reducer.id,
                bucket.start,
                bucket.customer_id,
                bucket.external_customer_id,
            ))
            .map(Vec::as_slice)
            .unwrap_or_default();
        let mut intervals: BTreeSet<(DateTime<Utc>, DateTime<Utc>)> = slot
            .iter()
            .map(|stored| (stored.bucket_start, stored.bucket_end))
            .collect();
        if intervals.is_empty() {
            let start = bucket_start_datetime(bucket.start);
            intervals.insert((start, start + TimeDelta::seconds(BUCKET_SIZE_SECONDS)));
        }

        for (start, end) in intervals {
            let values = Vec::from_iter(
                contributions
                    .iter()
                    .filter(|(timestamp, _)| start <= *timestamp && *timestamp < end)
                    .map(|(_, value)| decimal(*value)),
            );
            if values.is_empty() {
                continue;
            }
            let totals = match reducer.aggregation {
                Aggregation::Count | Aggregation::Unique => Totals {
                    count: values.len() as i64,
                    sum: BigDecimal::from(0),
                    min: None,
                    max: None,
                },
                _ => Totals {
                    count: values.len() as i64,
                    sum: values.iter().sum(),
                    min: values.iter().min().cloned(),
                    max: values.iter().max().cloned(),
                },
            };
            let latest = slot
                .iter()
                .filter(|stored| stored.bucket_start == start)
                .max_by_key(|stored| stored.generation);
            writes.push(match latest {
                Some(latest) if latest.sealed_at.is_none() => Write::Addition {
                    bucket_id: latest.id,
                    totals,
                },
                latest => Write::NewBucket {
                    reducer_id: reducer.id,
                    customer_id: bucket.customer_id,
                    external_customer_id: bucket.external_customer_id,
                    start,
                    end,
                    generation: latest.map_or(1, |latest| latest.generation + 1),
                    totals,
                },
            });
        }
    }
    writes
}

fn decimal(value: f64) -> BigDecimal {
    BigDecimal::from_str(&value.to_string()).expect("finite floats format as decimal numbers")
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};
    use sqlx::Connection;

    use super::*;

    const SLOT: i64 = 1_735_689_600;

    fn reducer(id: u128, aggregation: Value) -> Reducer {
        serde_json::from_value(json!({
            "id": Uuid::from_u128(id),
            "filter": { "conjunction": "and", "clauses": [] },
            "aggregation": aggregation,
        }))
        .unwrap()
    }

    fn at(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(SLOT + seconds, 0).unwrap()
    }

    fn stored(id: u128, start: i64, end: i64, generation: i32, sealed: bool) -> StoredBucket {
        StoredBucket {
            id: Uuid::from_u128(id),
            reducer_id: Uuid::from_u128(1),
            customer_id: None,
            external_customer_id: Some("customer".to_owned()),
            bucket_start: at(start),
            bucket_end: at(end),
            generation,
            sealed_at: sealed.then(|| at(end)),
        }
    }

    fn bucket(reducer: usize) -> BucketId<'static> {
        BucketId {
            reducer,
            start: SLOT,
            customer_id: None,
            external_customer_id: Some("customer"),
        }
    }

    fn summary(writes: &[Write]) -> Vec<String> {
        Vec::from_iter(writes.iter().map(|write| match write {
            Write::Addition { bucket_id, totals } => format!(
                "add {} count={} sum={} min={:?} max={:?}",
                bucket_id.as_u128(),
                totals.count,
                totals.sum,
                totals.min.as_ref().map(ToString::to_string),
                totals.max.as_ref().map(ToString::to_string),
            ),
            Write::NewBucket {
                start,
                end,
                generation,
                totals,
                ..
            } => format!(
                "new {}..{} generation={generation} count={} sum={}",
                start.timestamp() - SLOT,
                end.timestamp() - SLOT,
                totals.count,
                totals.sum,
            ),
        }))
    }

    #[tokio::test]
    #[ignore = "needs the local development database"]
    async fn writes_closed_buckets_across_generations_and_splits() {
        let config = crate::config::Config::from_env().unwrap();
        let mut connection = PgConnection::connect_with(&config.postgres).await.unwrap();
        let organization_id: Uuid = sqlx::query_scalar("SELECT id FROM organizations LIMIT 1")
            .fetch_one(&mut connection)
            .await
            .unwrap();
        let mut transaction = connection.begin().await.unwrap();
        let reducer_id = Uuid::new_v4();
        let aggregation = json!({ "func": "sum", "property": "tokens" });
        sqlx::query(
            "INSERT INTO reducers (id, created_at, organization_id, filter, aggregation, kind) \
             VALUES ($1, now(), $2, '{\"conjunction\": \"and\", \"clauses\": []}', $3, 'usage')",
        )
        .bind(reducer_id)
        .bind(organization_id)
        .bind(&aggregation)
        .execute(&mut *transaction)
        .await
        .unwrap();
        let reducers = [serde_json::from_value::<Reducer>(json!({
            "id": reducer_id,
            "filter": { "conjunction": "and", "clauses": [] },
            "aggregation": aggregation,
        }))
        .unwrap()];
        let whole = bucket(0);
        let split = BucketId {
            start: SLOT + BUCKET_SIZE_SECONDS,
            ..bucket(0)
        };
        sqlx::query(
            "INSERT INTO reducer_buckets (id, created_at, organization_id, reducer_id, \
                 external_customer_id, bucket_start, bucket_end, count, sum, generation, sealed_at) \
             VALUES ($1, now(), $3, $4, 'customer', $5, $6, 1, 1, 1, now()), \
                    ($2, now(), $3, $4, 'customer', $6, $7, 1, 1, 1, NULL)",
        )
        .bind(Uuid::new_v4())
        .bind(Uuid::new_v4())
        .bind(organization_id)
        .bind(reducer_id)
        .bind(at(300))
        .bind(at(420))
        .bind(at(600))
        .execute(&mut *transaction)
        .await
        .unwrap();

        let first = vec![(at(10), 1.5), (at(20), 0.25)];
        let late = vec![(at(30), 2.0)];
        let across_split = vec![(at(310), 4.0), (at(500), 8.0), (at(599), 0.5)];
        add_to_closed_buckets(
            &mut transaction,
            organization_id,
            &reducers,
            vec![(&whole, &first), (&split, &across_split)],
        )
        .await
        .unwrap();
        add_to_closed_buckets(
            &mut transaction,
            organization_id,
            &reducers,
            vec![(&whole, &late)],
        )
        .await
        .unwrap();
        sqlx::query("UPDATE reducer_buckets SET sealed_at = now() WHERE reducer_id = $1")
            .bind(reducer_id)
            .execute(&mut *transaction)
            .await
            .unwrap();
        add_to_closed_buckets(
            &mut transaction,
            organization_id,
            &reducers,
            vec![(&whole, &late)],
        )
        .await
        .unwrap();

        type Row = (
            DateTime<Utc>,
            DateTime<Utc>,
            i32,
            i64,
            String,
            Option<String>,
            Option<String>,
        );
        let rows: Vec<Row> = sqlx::query_as(
            "SELECT bucket_start, bucket_end, generation, count, sum::text, min::text, \
                     max::text \
                 FROM reducer_buckets WHERE reducer_id = $1 \
                 ORDER BY bucket_start, generation",
        )
        .bind(reducer_id)
        .fetch_all(&mut *transaction)
        .await
        .unwrap();
        transaction.rollback().await.unwrap();
        let rows = Vec::from_iter(rows.into_iter().map(
            |(start, end, generation, count, sum, min, max)| {
                format!(
                    "{}..{} g{generation} count={count} sum={sum} min={min:?} max={max:?}",
                    start.timestamp() - SLOT,
                    end.timestamp() - SLOT,
                )
            },
        ));

        assert_eq!(
            rows,
            [
                r#"0..300 g1 count=3 sum=3.75 min=Some("0.25") max=Some("2")"#,
                r#"0..300 g2 count=1 sum=2 min=Some("2") max=Some("2")"#,
                r#"300..420 g1 count=1 sum=1 min=None max=None"#,
                r#"300..420 g2 count=1 sum=4 min=Some("4") max=Some("4")"#,
                r#"420..600 g1 count=3 sum=9.5 min=Some("0.5") max=Some("8")"#,
            ]
        );
    }

    #[tokio::test]
    #[ignore = "needs the local development database with at least one customer"]
    async fn counts_closed_events_for_a_polar_customer() {
        let config = crate::config::Config::from_env().unwrap();
        let mut connection = PgConnection::connect_with(&config.postgres).await.unwrap();
        let (customer_id, organization_id): (Uuid, Uuid) =
            sqlx::query_as("SELECT id, organization_id FROM customers LIMIT 1")
                .fetch_one(&mut connection)
                .await
                .unwrap();
        let mut transaction = connection.begin().await.unwrap();
        let reducer_id = Uuid::new_v4();
        let aggregation = json!({ "func": "count" });
        sqlx::query(
            "INSERT INTO reducers (id, created_at, organization_id, filter, aggregation, kind) \
             VALUES ($1, now(), $2, '{\"conjunction\": \"and\", \"clauses\": []}', $3, 'usage')",
        )
        .bind(reducer_id)
        .bind(organization_id)
        .bind(&aggregation)
        .execute(&mut *transaction)
        .await
        .unwrap();
        let reducers = [serde_json::from_value::<Reducer>(json!({
            "id": reducer_id,
            "filter": { "conjunction": "and", "clauses": [] },
            "aggregation": aggregation,
        }))
        .unwrap()];
        let bucket = BucketId {
            reducer: 0,
            start: SLOT,
            customer_id: Some(customer_id),
            external_customer_id: None,
        };
        let values = vec![(at(10), 1.0), (at(20), 1.0)];

        for _ in 0..2 {
            add_to_closed_buckets(
                &mut transaction,
                organization_id,
                &reducers,
                vec![(&bucket, &values)],
            )
            .await
            .unwrap();
        }
        type Row = (
            Option<Uuid>,
            Option<String>,
            i32,
            i64,
            String,
            Option<String>,
        );
        let rows: Vec<Row> = sqlx::query_as(
            "SELECT customer_id, external_customer_id, generation, count, sum::text, \
                     min::text \
                 FROM reducer_buckets WHERE reducer_id = $1",
        )
        .bind(reducer_id)
        .fetch_all(&mut *transaction)
        .await
        .unwrap();
        transaction.rollback().await.unwrap();

        assert_eq!(
            rows,
            [(Some(customer_id), None, 1, 4, "0".to_owned(), None)]
        );
    }

    #[test]
    fn creates_the_whole_slot_when_nothing_is_stored() {
        let reducers = [reducer(1, json!({ "func": "sum", "property": "tokens" }))];
        let values = vec![(at(10), 1.5), (at(299), 0.1), (at(20), 0.2)];

        let writes = plan_writes(&reducers, &[(&bucket(0), &values)], &[]);

        assert_eq!(
            summary(&writes),
            ["new 0..300 generation=1 count=3 sum=1.8"]
        );
    }

    #[test]
    fn adds_to_the_latest_generation_unless_it_is_sealed() {
        let reducers = [reducer(1, json!({ "func": "max", "property": "tokens" }))];
        let values = vec![(at(10), 3.0), (at(20), 7.0)];
        let open = [stored(10, 0, 300, 1, true), stored(11, 0, 300, 2, false)];
        let sealed = [stored(10, 0, 300, 1, true), stored(11, 0, 300, 2, true)];

        let added = plan_writes(&reducers, &[(&bucket(0), &values)], &open);
        let created = plan_writes(&reducers, &[(&bucket(0), &values)], &sealed);

        assert_eq!(
            summary(&added),
            [r#"add 11 count=2 sum=10 min=Some("3") max=Some("7")"#]
        );
        assert_eq!(
            summary(&created),
            ["new 0..300 generation=3 count=2 sum=10"]
        );
    }

    #[test]
    fn keeps_the_boundaries_a_seal_split_the_slot_into() {
        let reducers = [reducer(1, json!({ "func": "count" }))];
        let values = vec![(at(10), 1.0), (at(120), 1.0), (at(200), 1.0)];
        let split = [stored(10, 0, 120, 1, true), stored(11, 120, 300, 1, false)];

        let writes = plan_writes(&reducers, &[(&bucket(0), &values)], &split);

        assert_eq!(
            summary(&writes),
            [
                "new 0..120 generation=2 count=1 sum=0",
                "add 11 count=2 sum=0 min=None max=None",
            ]
        );
    }

    #[test]
    fn ignores_buckets_of_other_reducers_and_customers() {
        let reducers = [
            reducer(1, json!({ "func": "count" })),
            reducer(2, json!({ "func": "count" })),
        ];
        let values = vec![(at(10), 1.0)];
        let mut other_customer = stored(12, 0, 300, 1, false);
        other_customer.external_customer_id = Some("other".to_owned());
        let rows = [stored(10, 0, 300, 1, false), other_customer];

        let writes = plan_writes(&reducers, &[(&bucket(1), &values)], &rows);

        assert_eq!(summary(&writes), ["new 0..300 generation=1 count=1 sum=0"]);
    }
}
