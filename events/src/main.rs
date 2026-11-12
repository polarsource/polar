mod app;
mod auth;
mod config;
mod jobs;
mod telemetry;

use std::{net::Ipv4Addr, sync::Arc, time::Duration};

use anyhow::{Context, Result};
use redis::aio::ConnectionManager;
use sqlx::postgres::PgPoolOptions;
use tokio::{
    net::TcpListener,
    signal::unix::{SignalKind, signal},
};

use crate::{app::AppState, config::Config};

#[tokio::main]
async fn main() -> Result<()> {
    let config = Config::from_env()?;
    let _telemetry = telemetry::init(&config)?;

    let db = PgPoolOptions::new()
        .max_connections(config.postgres_pool_size)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(config.postgres)
        .await
        .context("connecting to Postgres")?;
    let redis = ConnectionManager::new(redis::Client::open(config.redis_url)?)
        .await
        .context("connecting to Redis")?;

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, config.port)).await?;
    tracing::info!(port = config.port, "listening");

    axum::serve(
        listener,
        app::router(AppState {
            db: db.clone(),
            redis,
            auth: Arc::new(config.auth),
        }),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    db.close().await;
    Ok(())
}

async fn shutdown_signal() {
    let mut sigterm = signal(SignalKind::terminate()).expect("SIGTERM handler");
    tokio::select! {
        _ = sigterm.recv() => {}
        _ = tokio::signal::ctrl_c() => {}
    }
    tracing::info!("shutting down");
}
