use axum::{routing::get, routing::post, Router};
use std::net::SocketAddr;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

use terraqura_verifier::config::Config;
use terraqura_verifier::handlers;

#[tokio::main]
async fn main() {
    let config = Config::from_env();

    // Initialise structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new(&config.log_level)),
        )
        .init();

    tracing::info!(
        "TerraQura Verifier v{} starting on {}:{}",
        env!("CARGO_PKG_VERSION"),
        config.host,
        config.port
    );

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(handlers::health))
        .route("/verify", post(handlers::verify))
        .route("/merkle/build", post(handlers::merkle_build))
        .route("/merkle/verify", post(handlers::merkle_verify))
        .route("/provenance/verify", post(handlers::provenance_verify))
        .route("/sensor/validate", post(handlers::sensor_validate))
        .route(
            "/sensor/batch-validate",
            post(handlers::sensor_batch_validate),
        )
        .layer(cors);

    let addr = SocketAddr::new(config.host, config.port);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    tracing::info!("listening on {addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received, starting graceful shutdown");
}
