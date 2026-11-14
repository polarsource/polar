use std::time::Duration;

use anyhow::{Result, anyhow};
use axum::{
    extract::MatchedPath,
    http::{Request, Response},
};
use logfire::{
    ShutdownGuard,
    config::{ConsoleOptions, SendToLogfire},
};
use tracing::{Span, field::Empty};

use crate::config::Config;

pub fn init(config: &Config) -> Result<ShutdownGuard> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|_| anyhow!("a rustls crypto provider is already installed"))?;

    let mut builder = logfire::configure()
        .send_to_logfire(SendToLogfire::IfTokenPresent)
        .with_service_name(&config.service_name)
        .with_environment(&config.environment)
        .with_default_level_filter(config.log_level)
        .with_console(config.logfire_token.is_none().then(ConsoleOptions::default));
    if let Some(token) = &config.logfire_token {
        builder = builder.with_token(token);
    }
    if let Some(version) = &config.release_version {
        builder = builder.with_service_version(version);
    }
    Ok(builder.finish()?.shutdown_guard())
}

pub fn request_span<B>(request: &Request<B>) -> Span {
    let method = request.method().as_str();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str);
    let name = match route {
        Some(route) => format!("{method} {route}"),
        None => method.to_owned(),
    };
    tracing::info_span!(
        "request",
        otel.name = name,
        otel.kind = "server",
        otel.status_code = Empty,
        http.request.method = method,
        http.route = route,
        url.path = request.uri().path(),
        http.response.status_code = Empty,
        subject_type = Empty,
        subject_id = Empty,
        inserted_events = Empty,
        skipped_duplicates = Empty,
    )
}

pub fn record_response<B>(response: &Response<B>, _latency: Duration, span: &Span) {
    let status = response.status();
    span.record("http.response.status_code", status.as_u16());
    if status.is_server_error() {
        span.record("otel.status_code", "ERROR");
    }
}

pub fn background_span(name: &'static str) -> Span {
    let span = tracing::info_span!(parent: None, "background", otel.name = name);
    span.follows_from(Span::current());
    span
}

pub fn log_database_error(error: &sqlx::Error, operation: &'static str) {
    match error.as_database_error() {
        Some(database_error) => tracing::error!(
            operation,
            sqlstate = database_error.code().as_deref(),
            constraint = database_error.constraint(),
            "database error"
        ),
        None => tracing::error!(operation, %error, "database error"),
    }
}
