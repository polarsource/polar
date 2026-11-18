use std::{
    collections::{HashMap, HashSet},
    env,
    time::Duration,
};

use anyhow::{Context, Result, ensure};
use redis::IntoConnectionInfo;
use sqlx::postgres::{PgConnectOptions, PgSslMode};
use tracing::level_filters::LevelFilter;

use crate::{aws::AwsSettings, client_ip::TrustedProxies, jobs::SqsSettings};

const MAX_TOKEN_CACHE_TTL_SECONDS: f64 = 86_400.0;
const MAX_POSTGRES_POOL_SIZE: u32 = 2;

pub struct Config {
    pub port: u16,
    pub environment: String,
    pub service_name: String,
    pub release_version: Option<String>,
    pub log_level: LevelFilter,
    pub logfire_token: Option<String>,
    pub postgres: PgConnectOptions,
    pub postgres_pool_size: u32,
    pub organization_access_token_cache_ttl: Duration,
    pub redis_url: String,
    pub secret: String,
    pub hash_secrets: HashMap<String, String>,
    pub hash_secret_arn: Option<String>,
    pub base_url: String,
    pub aws: AwsSettings,
    pub worker_sqs: Option<SqsSettings>,
    pub trusted_proxies: TrustedProxies,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Self::from_lookup(|key| env::var(key).ok())
    }

    fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self> {
        let var = |key: &str, default: &str| lookup(key).unwrap_or_else(|| default.to_owned());

        let flag = |key: &str| {
            matches!(
                var(key, "false").to_lowercase().as_str(),
                "true" | "t" | "1" | "yes" | "y" | "on"
            )
        };
        let postgres_ssl = flag("POLAR_POSTGRES_SSL");
        let postgres = PgConnectOptions::new()
            .host(&var("POLAR_POSTGRES_HOST", "127.0.0.1"))
            .port(
                var("POLAR_POSTGRES_PORT", "5432")
                    .parse()
                    .context("POLAR_POSTGRES_PORT")?,
            )
            .username(&var("POLAR_POSTGRES_USER", "polar"))
            .password(&var("POLAR_POSTGRES_PWD", "polar"))
            .database(&var("POLAR_POSTGRES_DATABASE", "polar"))
            .application_name("events")
            .ssl_mode(if postgres_ssl {
                PgSslMode::Require
            } else {
                lookup("PGSSLMODE")
                    .map(|mode| mode.parse())
                    .transpose()
                    .context("PGSSLMODE")?
                    .unwrap_or(PgSslMode::Prefer)
            });

        let redis_url = lookup("POLAR_REDIS_URL").unwrap_or_else(|| {
            format!(
                "redis://{}:{}/{}",
                var("POLAR_REDIS_HOST", "127.0.0.1"),
                var("POLAR_REDIS_PORT", "6379"),
                var("POLAR_REDIS_DB", "0"),
            )
        });

        let hash_secrets: HashMap<String, String> =
            serde_json::from_str(&var("POLAR_HASH_SECRETS", "{}")).context("POLAR_HASH_SECRETS")?;

        let environment = var("POLAR_ENV", "development");
        let sqs_actors: HashSet<String> = serde_json::from_str(&var(
            "POLAR_WORKER_SQS_ACTORS",
            r#"["dummy", "observability.invariants.enqueue", "observability.invariants.check"]"#,
        ))
        .context("POLAR_WORKER_SQS_ACTORS")?;
        let worker_sqs = flag("POLAR_WORKER_SQS_ENABLED").then(|| SqsSettings {
            queue_prefix: var("POLAR_WORKER_SQS_QUEUE_PREFIX", "polar-tasks"),
            actors: (sqs_actors != HashSet::from(["*".to_owned()])).then_some(sqs_actors),
            endpoint_url: lookup("POLAR_SQS_ENDPOINT_URL"),
        });
        let aws = AwsSettings {
            region: var("POLAR_AWS_REGION", "us-east-2"),
            static_credentials: matches!(environment.as_str(), "development" | "testing").then(
                || {
                    (
                        var("POLAR_AWS_ACCESS_KEY_ID", "polar-development"),
                        var("POLAR_AWS_SECRET_ACCESS_KEY", "polar123456789"),
                    )
                },
            ),
        };

        Ok(Self {
            port: var("PORT", "10000").parse().context("PORT")?,
            environment,
            service_name: var("RENDER_SERVICE_NAME", "events"),
            release_version: lookup("RELEASE_VERSION"),
            log_level: var("POLAR_LOG_LEVEL", "info")
                .parse()
                .unwrap_or(LevelFilter::INFO),
            logfire_token: lookup("POLAR_LOGFIRE_TOKEN"),
            postgres,
            postgres_pool_size: var("POLAR_DATABASE_POOL_SIZE", "2")
                .parse::<u32>()
                .context("POLAR_DATABASE_POOL_SIZE")?
                .min(MAX_POSTGRES_POOL_SIZE),
            organization_access_token_cache_ttl: Duration::try_from_secs_f64(
                var("POLAR_ORGANIZATION_ACCESS_TOKEN_CACHE_TTL_SECONDS", "0")
                    .parse::<f64>()
                    .context("POLAR_ORGANIZATION_ACCESS_TOKEN_CACHE_TTL_SECONDS")?
                    .clamp(0.0, MAX_TOKEN_CACHE_TTL_SECONDS),
            )
            .context("POLAR_ORGANIZATION_ACCESS_TOKEN_CACHE_TTL_SECONDS")?,
            redis_url,
            secret: var("POLAR_SECRET", "super secret jwt secret"),
            hash_secrets,
            hash_secret_arn: lookup("POLAR_AWS_HASH_SECRET_ARN").filter(|arn| !arn.is_empty()),
            base_url: var("POLAR_BASE_URL", "http://127.0.0.1:8000"),
            aws,
            worker_sqs,
            trusted_proxies: TrustedProxies::parse(&var("FORWARDED_ALLOW_IPS", "127.0.0.1"))
                .context("FORWARDED_ALLOW_IPS")?,
        })
    }
}

pub fn redis_client(url: &str) -> Result<redis::Client> {
    let parsed = redis::parse_redis_url(url).context("the Redis URL is invalid")?;
    ensure!(
        parsed.fragment().is_none(),
        "the Redis URL must not have a fragment"
    );
    let skip_hostname_check = parsed.query_pairs().any(|(key, value)| {
        key == "ssl_check_hostname"
            && matches!(
                value.to_lowercase().as_str(),
                "false" | "0" | "f" | "n" | "no"
            )
    });
    let info = url.into_connection_info()?;
    let mut addr = info.addr().clone();
    addr.set_danger_accept_invalid_hostnames(skip_hostname_check);
    Ok(redis::Client::open(info.set_addr(addr))?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(vars: &[(&str, &str)]) -> Result<Config> {
        Config::from_lookup(|key| {
            vars.iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| (*value).to_owned())
        })
    }

    #[test]
    fn defaults_match_local_dev_stack() {
        let config = config(&[]).unwrap();

        assert_eq!(config.port, 10000);
        assert_eq!(config.environment, "development");
        assert_eq!(config.service_name, "events");
        assert_eq!(config.log_level, LevelFilter::INFO);
        assert!(config.logfire_token.is_none());
        assert!(config.worker_sqs.is_none());
        assert_eq!(config.postgres.get_host(), "127.0.0.1");
        assert_eq!(config.postgres.get_port(), 5432);
        assert_eq!(config.postgres.get_database(), Some("polar"));
        assert_eq!(config.redis_url, "redis://127.0.0.1:6379/0");
    }

    #[test]
    fn skips_the_redis_hostname_check_only_when_the_url_asks() {
        let checked = redis_client("rediss://cache.internal:6379/1").unwrap();
        let unchecked =
            redis_client("rediss://cache.internal:6379/1?ssl_check_hostname=False").unwrap();
        let insecure = redis_client("rediss://cache.internal:6379/1#insecure");

        let skips_hostname_check = |client: &redis::Client| {
            format!("{:?}", client.get_connection_info().addr())
                .contains("danger_accept_invalid_hostnames: true")
        };
        assert!(!skips_hostname_check(&checked));
        assert!(skips_hostname_check(&unchecked));
        assert_eq!(unchecked.get_connection_info().redis_settings().db(), 1);
        assert!(insecure.is_err());
    }

    #[test]
    fn takes_the_postgres_tls_mode_from_pgsslmode_unless_tls_is_forced() {
        let ssl_mode = |vars: &[(&str, &str)]| config(vars).map(|c| c.postgres.get_ssl_mode());

        assert!(matches!(ssl_mode(&[]), Ok(PgSslMode::Prefer)));
        assert!(matches!(
            ssl_mode(&[("PGSSLMODE", "verify-full")]),
            Ok(PgSslMode::VerifyFull)
        ));
        assert!(matches!(
            ssl_mode(&[("POLAR_POSTGRES_SSL", "true"), ("PGSSLMODE", "disable")]),
            Ok(PgSslMode::Require)
        ));
        assert!(ssl_mode(&[("PGSSLMODE", "verify_full")]).is_err());
    }

    #[test]
    fn reads_overrides() {
        let config = config(&[
            ("PORT", "8080"),
            ("POLAR_ENV", "production"),
            ("POLAR_LOG_LEVEL", "DEBUG"),
            ("POLAR_LOGFIRE_TOKEN", "token"),
            ("POLAR_WORKER_SQS_ENABLED", "true"),
            ("POLAR_WORKER_SQS_ACTORS", r#"["reducer_bucket.sync"]"#),
            ("POLAR_WORKER_SQS_QUEUE_PREFIX", "polar-production-tasks"),
            ("POLAR_POSTGRES_HOST", "db.internal"),
            ("POLAR_POSTGRES_SSL", "True"),
            ("POLAR_REDIS_HOST", "ignored"),
            ("POLAR_REDIS_URL", "rediss://cache.internal:6380/1"),
        ])
        .unwrap();

        assert_eq!(config.port, 8080);
        assert_eq!(config.environment, "production");
        assert_eq!(config.log_level, LevelFilter::DEBUG);
        assert_eq!(config.logfire_token.as_deref(), Some("token"));
        let worker_sqs = config.worker_sqs.unwrap();
        assert_eq!(worker_sqs.queue_prefix, "polar-production-tasks");
        assert_eq!(
            worker_sqs.actors,
            Some(HashSet::from(["reducer_bucket.sync".to_owned()]))
        );
        assert_eq!(config.aws.region, "us-east-2");
        assert!(config.aws.static_credentials.is_none());
        assert_eq!(config.postgres.get_host(), "db.internal");
        assert!(matches!(config.postgres.get_ssl_mode(), PgSslMode::Require));
        assert_eq!(config.redis_url, "rediss://cache.internal:6380/1");
    }

    #[test]
    fn routes_every_actor_to_sqs_on_a_wildcard() {
        let config = config(&[
            ("POLAR_WORKER_SQS_ENABLED", "true"),
            ("POLAR_WORKER_SQS_ACTORS", r#"["*"]"#),
        ])
        .unwrap();

        assert!(config.worker_sqs.unwrap().actors.is_none());
    }

    #[test]
    fn rejects_invalid_values() {
        assert!(config(&[("POLAR_POSTGRES_PORT", "not-a-port")]).is_err());
        assert!(config(&[("POLAR_HASH_SECRETS", "not-json")]).is_err());
        for value in [
            "10.0.0.0/33",
            "::/129",
            "10.0.0.1/8",
            "2001:db8::1/32",
            "bad",
            "*,127.0.0.1",
            " * ",
            "127.0.0.1,",
        ] {
            let error = config(&[("FORWARDED_ALLOW_IPS", value)]).err().unwrap();
            assert_eq!(error.to_string(), "FORWARDED_ALLOW_IPS", "{value}");
        }
        assert!(config(&[("FORWARDED_ALLOW_IPS", "")]).is_ok());
    }
}
