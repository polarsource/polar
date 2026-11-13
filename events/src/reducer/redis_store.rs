use std::fmt::Write;

use ring::digest;
use uuid::Uuid;

use super::{BucketId, Reducer, TimedValues, filter::Aggregation};

pub(super) const BUCKET_TTL_SECONDS: i64 = 24 * 60 * 60;

pub(super) fn bucket_key(reducer_id: Uuid, bucket: &BucketId) -> String {
    let mut key = format!("reducer_bucket:{reducer_id}:{}:", bucket.start);
    match bucket.customer_id {
        Some(customer_id) => write!(key, "{customer_id}"),
        None => write!(key, "-"),
    }
    .expect("writing to a String cannot fail");
    if let Some(external_customer_id) = bucket.external_customer_id {
        key.push(':');
        for byte in digest::digest(&digest::SHA256, external_customer_id.as_bytes()).as_ref() {
            write!(key, "{byte:02x}").expect("writing to a String cannot fail");
        }
    }
    key
}

pub(super) fn bucket_increments(
    reducers: &[Reducer],
    contributions: &[(&BucketId<'_>, &TimedValues)],
) -> redis::Pipeline {
    let mut pipeline = redis::pipe();
    for (bucket, values) in contributions {
        let reducer = &reducers[bucket.reducer];
        let key = bucket_key(reducer.id, bucket);
        // ponytail: Python sums as Decimal before converting; summing floats can differ in the
        // last digit. These buckets are replaced by the Postgres sync once they close.
        let values = Vec::from_iter(values.iter().map(|(_, value)| *value));
        let sum: f64 = values.iter().sum();
        match reducer.aggregation {
            Aggregation::Count => pipeline.incr(&key, values.len()),
            Aggregation::Sum { .. } => pipeline.incr(&key, sum),
            Aggregation::Avg { .. } => pipeline
                .hincr(&key, "count", values.len())
                .hincr(&key, "sum", sum),
            Aggregation::Min { .. } => pipeline
                .cmd("ZADD")
                .arg(&key)
                .arg("LT")
                .arg(values.iter().copied().fold(f64::INFINITY, f64::min))
                .arg("min"),
            Aggregation::Max { .. } => pipeline
                .cmd("ZADD")
                .arg(&key)
                .arg("GT")
                .arg(values.iter().copied().fold(f64::NEG_INFINITY, f64::max))
                .arg("max"),
            Aggregation::Unique => continue,
        };
        pipeline
            .cmd("EXPIRE")
            .arg(&key)
            .arg(BUCKET_TTL_SECONDS)
            .arg("NX");
    }
    pipeline
}
