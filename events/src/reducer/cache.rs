use redis::{AsyncCommands, RedisResult, aio::ConnectionManager};
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use super::Reducer;

const ACTIVE_REDUCERS_CACHE_TTL_SECONDS: u64 = 6 * 60 * 60;

pub(super) fn active_reducers_cache_key(organization_id: Uuid) -> String {
    format!("reducers:active:v2:{organization_id}")
}

pub(super) async fn active_reducers(
    connection: &mut PgConnection,
    redis_client: &redis::Client,
    redis: &mut ConnectionManager,
    organization_id: Uuid,
) -> Result<Vec<Reducer>, sqlx::Error> {
    let key = active_reducers_cache_key(organization_id);
    let cached: RedisResult<Option<String>> = redis.get(&key).await;
    let refill = match cached {
        Ok(Some(cached)) if !cached.is_empty() => match serde_json::from_str(&cached) {
            Ok(reducers) => return Ok(reducers),
            Err(error) => {
                tracing::error!(
                    line = error.line(),
                    column = error.column(),
                    "cached active reducers are invalid"
                );
                false
            }
        },
        Ok(_) => true,
        Err(error) => {
            tracing::error!(%error, "failed to read cached active reducers");
            false
        }
    };
    if !refill {
        return parse_reducers(select_active_reducers(connection, organization_id).await?);
    }

    // WATCH is per connection: the shared multiplexed one would leak it to other requests.
    let watcher = async {
        let mut watcher = redis_client.get_multiplexed_async_connection().await?;
        redis::cmd("WATCH")
            .arg(&key)
            .query_async::<()>(&mut watcher)
            .await?;
        Ok::<_, redis::RedisError>(watcher)
    }
    .await;
    let active = select_active_reducers(connection, organization_id).await?;
    let stored = match watcher {
        Ok(mut watcher) => {
            redis::pipe()
                .atomic()
                .set_ex(&key, active.to_string(), ACTIVE_REDUCERS_CACHE_TTL_SECONDS)
                .query_async::<Option<()>>(&mut watcher)
                .await
        }
        Err(error) => Err(error),
    };
    if let Err(error) = stored {
        tracing::error!(%error, "failed to cache active reducers");
    }
    parse_reducers(active)
}

async fn select_active_reducers(
    connection: &mut PgConnection,
    organization_id: Uuid,
) -> Result<Value, sqlx::Error> {
    let rows: Vec<(Uuid, Value, Value)> = sqlx::query_as(
        "SELECT reducers.id, reducers.filter, reducers.aggregation \
         FROM reducers \
         WHERE reducers.kind = 'usage' AND reducers.id IN (\
             SELECT meter_reducers.reducer_id \
             FROM meter_reducers JOIN meters ON meters.id = meter_reducers.meter_id \
             WHERE meters.archived_at IS NULL AND meters.deleted_at IS NULL AND (\
                 meters.is_current OR NOT EXISTS (\
                     SELECT catalogs.id FROM catalogs \
                     WHERE catalogs.id = meters.catalog_id AND catalogs.status = 'draft'\
                 )\
             )\
         ) AND reducers.organization_id = $1",
    )
    .bind(organization_id)
    .fetch_all(connection)
    .await?;
    Ok(Value::Array(Vec::from_iter(rows.into_iter().map(
        |(id, filter, aggregation)| {
            json!({
                "id": id,
                "organization_id": organization_id,
                "kind": "usage",
                "filter": filter,
                "aggregation": aggregation,
            })
        },
    ))))
}

fn parse_reducers(reducers: Value) -> Result<Vec<Reducer>, sqlx::Error> {
    serde_json::from_value(reducers).map_err(|error| sqlx::Error::Decode(error.into()))
}
