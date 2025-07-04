use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    db::{models::*, queries},
    AppState,
};

use super::ApiError;

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TrackListResponse {
    tracks: Vec<Track>,
    count: usize,
}

pub async fn list_tracks(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<TrackListResponse>, ApiError> {
    let tracks = match params.q {
        Some(query) => queries::search_tracks(&state.db, &query).await?,
        None => queries::get_all_tracks(&state.db).await?,
    };

    let count = tracks.len();
    Ok(Json(TrackListResponse { tracks, count }))
}

pub async fn get_track(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Track>, ApiError> {
    let track = queries::get_track_by_id(&state.db, &id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Track not found"))?;

    Ok(Json(track))
}

pub async fn create_track(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTrack>,
) -> Result<Json<Track>, ApiError> {
    let track = payload.into_track();
    let track = queries::create_track(&state.db, track).await?;
    Ok(Json(track))
}

pub async fn delete_track(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let deleted = queries::delete_track(&state.db, &id).await?;
    
    if !deleted {
        return Err(anyhow::anyhow!("Track not found").into());
    }

    Ok(Json(serde_json::json!({
        "message": "Track deleted successfully"
    })))
}