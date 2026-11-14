use axum::{
    http::{HeaderValue, StatusCode, header::RETRY_AFTER},
    response::{IntoResponse, Response},
};
use redis::{RedisResult, Script, aio::ConnectionManager};
use serde_json::json;
use uuid::Uuid;

const SCRIPT: &str = r"
local ruleset = cjson.decode(ARGV[1])

-- Set limits
for i, key in pairs(KEYS) do
    redis.call('SET', key, ruleset[key][1], 'EX', ruleset[key][2], 'NX')
end

-- Check limits
for i = 1, #KEYS do
    local value = redis.call('GET', KEYS[i])
    if value and tonumber(value) < 1 then
        return ruleset[KEYS[i]][2]
    end
end

-- Decrease limits
for i, key in pairs(KEYS) do
    redis.call('DECR', key)
end
return 0
";
const API_ZONE: &str = "api";
const IP_ZONE: &str = "ip";
const DEFAULT_GROUP: &str = "default";
const IP_LIMIT: Limit = Limit::per_second(1000);

#[derive(Clone, Copy, Debug, PartialEq)]
struct Limit {
    period: &'static str,
    seconds: u64,
    requests: u64,
}

impl Limit {
    const fn per_second(requests: u64) -> Self {
        Self {
            period: "second",
            seconds: 1,
            requests,
        }
    }

    const fn per_minute(requests: u64) -> Self {
        Self {
            period: "minute",
            seconds: 60,
            requests,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Environment {
    Production,
    Sandbox,
}

pub struct RateLimiter {
    script: Script,
    environment: Option<Environment>,
}

impl RateLimiter {
    pub fn new(environment: &str) -> Self {
        Self {
            script: Script::new(SCRIPT),
            environment: match environment {
                "production" => Some(Environment::Production),
                "sandbox" => Some(Environment::Sandbox),
                _ => None,
            },
        }
    }

    pub async fn organization_retry_after(
        &self,
        redis: &mut ConnectionManager,
        organization_id: Uuid,
        group: &str,
    ) -> RedisResult<u64> {
        let Some(environment) = self.environment else {
            return Ok(0);
        };
        let Some(limit) = api_limit(environment, group).or_else(|| {
            tracing::warn!(
                group,
                "no rate limit is defined for the organization's group, using the default"
            );
            api_limit(environment, DEFAULT_GROUP)
        }) else {
            return Ok(0);
        };
        self.retry_after(
            redis,
            API_ZONE,
            &format!("organization:{organization_id}"),
            limit,
        )
        .await
    }

    pub async fn anonymous_retry_after(
        &self,
        redis: &mut ConnectionManager,
        ip: Option<&str>,
    ) -> RedisResult<u64> {
        let Some(limit) = self
            .environment
            .and_then(|environment| api_limit(environment, DEFAULT_GROUP))
        else {
            return Ok(0);
        };
        self.retry_after(redis, API_ZONE, ip.unwrap_or("anonymous"), limit)
            .await
    }

    pub async fn ip_retry_after(
        &self,
        redis: &mut ConnectionManager,
        ip: Option<&str>,
    ) -> RedisResult<u64> {
        if self.environment.is_none() {
            return Ok(0);
        }
        let user = format!("ip:{}", ip.unwrap_or("anonymous"));
        self.retry_after(redis, IP_ZONE, &user, IP_LIMIT).await
    }

    async fn retry_after(
        &self,
        redis: &mut ConnectionManager,
        zone: &str,
        user: &str,
        limit: Limit,
    ) -> RedisResult<u64> {
        let blocked_for: i64 = redis::cmd("TTL")
            .arg(format!("blocking:{user}"))
            .query_async(redis)
            .await?;
        if blocked_for > 0 {
            return Ok(blocked_for as u64);
        }
        let key = limit_key(zone, user, limit);
        self.script
            .key(&key)
            .arg(json!({ key.as_str(): [limit.requests, limit.seconds] }).to_string())
            .invoke_async(redis)
            .await
    }
}

fn limit_key(zone: &str, user: &str, limit: Limit) -> String {
    format!("{zone}:*:{user}:{}", limit.period)
}

fn api_limit(environment: Environment, group: &str) -> Option<Limit> {
    Some(match (environment, group) {
        (Environment::Production, "restricted") => Limit::per_minute(60),
        (Environment::Production, "default") => Limit::per_minute(500),
        (Environment::Production, "web" | "elevated") => Limit::per_second(100),
        (Environment::Sandbox, "restricted") => Limit::per_minute(10),
        (Environment::Sandbox, "default") => Limit::per_minute(100),
        (Environment::Sandbox, "web" | "elevated") => Limit::per_second(50),
        _ => return None,
    })
}

pub fn too_many_requests(retry_after: u64) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(RETRY_AFTER, HeaderValue::from(retry_after))],
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use redis::AsyncCommands;

    use super::*;

    #[test]
    fn picks_the_limit_of_the_environment_and_group() {
        assert_eq!(
            api_limit(Environment::Production, "default"),
            Some(Limit::per_minute(500))
        );
        assert_eq!(
            api_limit(Environment::Production, "elevated"),
            Some(Limit::per_second(100))
        );
        assert_eq!(
            api_limit(Environment::Sandbox, "restricted"),
            Some(Limit::per_minute(10))
        );
        assert_eq!(api_limit(Environment::Sandbox, "unknown"), None);
    }

    #[test]
    fn builds_the_keys_the_python_limiter_uses() {
        let organization = format!("organization:{}", Uuid::from_u128(1));

        assert_eq!(
            limit_key(API_ZONE, &organization, Limit::per_minute(500)),
            "api:*:organization:00000000-0000-0000-0000-000000000001:minute"
        );
        assert_eq!(
            limit_key(IP_ZONE, "ip:203.0.113.7", IP_LIMIT),
            "ip:*:ip:203.0.113.7:second"
        );
        assert_eq!(
            limit_key(API_ZONE, "203.0.113.7", Limit::per_minute(500)),
            "api:*:203.0.113.7:minute"
        );
    }

    #[tokio::test]
    #[ignore = "needs the local development Redis"]
    async fn limits_an_organization_and_honours_blocks() {
        let config = crate::config::Config::from_env().unwrap();
        let mut redis = ConnectionManager::new(redis::Client::open(config.redis_url).unwrap())
            .await
            .unwrap();
        let limiter = RateLimiter::new("sandbox");
        let disabled = RateLimiter::new("development");
        let organization_id = Uuid::new_v4();
        let user = format!("organization:{organization_id}");
        let key = limit_key(API_ZONE, &user, Limit::per_minute(10));

        let mut allowed = 0;
        let mut retry_after = 0;
        for _ in 0..11 {
            retry_after = limiter
                .organization_retry_after(&mut redis, organization_id, "restricted")
                .await
                .unwrap();
            allowed += u64::from(retry_after == 0);
        }
        let unlimited = disabled
            .organization_retry_after(&mut redis, organization_id, "restricted")
            .await
            .unwrap();
        let _: () = redis.del(&key).await.unwrap();
        let _: () = redis
            .set_ex(format!("blocking:{user}"), 1, 30)
            .await
            .unwrap();
        let blocked = limiter
            .organization_retry_after(&mut redis, organization_id, "restricted")
            .await
            .unwrap();
        let _: () = redis.del(&[key, format!("blocking:{user}")]).await.unwrap();

        assert_eq!((allowed, retry_after, unlimited), (10, 60, 0));
        assert!((1..=30).contains(&blocked));
    }
}
