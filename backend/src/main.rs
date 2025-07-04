use anyhow::Result;
use axum::{Json, Router, routing::{get, post, delete}};
use serde_json::json;
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod handlers;
mod storage;

use config::Config;
use db::DbPool;
use storage::R2Storage;

pub struct AppState {
    pub config: Config,
    pub db: DbPool,
    pub storage: R2Storage,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "navicore_music=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    info!("Loaded configuration");

    let db = db::create_pool(&config.database.url).await?;
    info!("Connected to database");

    let access_key_id = std::env::var("R2_ACCESS_KEY_ID")
        .unwrap_or_else(|_| "dev-access-key".to_string());
    let secret_access_key = std::env::var("R2_SECRET_ACCESS_KEY")
        .unwrap_or_else(|_| "dev-secret-key".to_string());

    let storage = R2Storage::new(
        config.storage.bucket_name.clone(),
        config.storage.endpoint_url.clone(),
        access_key_id,
        secret_access_key,
    )
    .await?;
    info!("Initialized R2 storage");

    let app_state = Arc::new(AppState {
        config: config.clone(),
        db,
        storage,
    });

    let app = create_router(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    info!("Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(|| async { "Navicore Music API" }))
        .route("/health", get(health_check))
        .route("/api/v1/tracks", get(handlers::tracks::list_tracks))
        .route("/api/v1/tracks", post(handlers::tracks::create_track))
        .route("/api/v1/tracks/:id", get(handlers::tracks::get_track))
        .route("/api/v1/tracks/:id", delete(handlers::tracks::delete_track))
        .route("/api/v1/tracks/:id/stream", get(handlers::stream::get_stream_url))
        .route("/api/v1/tracks/:id/play", post(handlers::stream::record_play))
        .route("/api/v1/playlists", get(handlers::playlists::list_playlists))
        .route("/api/v1/playlists", post(handlers::playlists::create_playlist))
        .route("/api/v1/playlists/:id", get(handlers::playlists::get_playlist))
        .route("/api/v1/playlists/:id/tracks", post(handlers::playlists::add_track_to_playlist))
        .route("/api/v1/playlists/:id/tracks/:track_id", delete(handlers::playlists::remove_track_from_playlist))
        .route("/api/v1/auth/login", post(handlers::auth::login))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "navicore-music-api",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
