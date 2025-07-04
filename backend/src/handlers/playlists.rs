use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    db::{models::*, queries},
    AppState,
};

use super::ApiError;

#[derive(Debug, Serialize)]
pub struct PlaylistResponse {
    playlist: Playlist,
    tracks: Vec<Track>,
}

#[derive(Debug, Deserialize)]
pub struct AddTrackRequest {
    track_id: String,
    position: Option<i32>,
}

pub async fn list_playlists(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Playlist>>, ApiError> {
    let playlists = queries::get_all_playlists(&state.db).await?;
    Ok(Json(playlists))
}

pub async fn get_playlist(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<PlaylistResponse>, ApiError> {
    let playlist = queries::get_playlist_by_id(&state.db, &id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Playlist not found"))?;

    let tracks = queries::get_playlist_tracks(&state.db, &id).await?;

    Ok(Json(PlaylistResponse { playlist, tracks }))
}

pub async fn create_playlist(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreatePlaylist>,
) -> Result<Json<Playlist>, ApiError> {
    let playlist = payload.into_playlist();
    let playlist = queries::create_playlist(&state.db, playlist).await?;
    Ok(Json(playlist))
}

pub async fn add_track_to_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<String>,
    Json(payload): Json<AddTrackRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let tracks = queries::get_playlist_tracks(&state.db, &playlist_id).await?;
    let position = payload.position.unwrap_or(tracks.len() as i32);

    queries::add_track_to_playlist(
        &state.db,
        &playlist_id,
        &payload.track_id,
        position,
    )
    .await?;

    Ok(Json(serde_json::json!({
        "message": "Track added to playlist"
    })))
}

pub async fn remove_track_from_playlist(
    State(state): State<Arc<AppState>>,
    Path((playlist_id, track_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let removed = queries::remove_track_from_playlist(&state.db, &playlist_id, &track_id).await?;

    if !removed {
        return Err(anyhow::anyhow!("Track not found in playlist").into());
    }

    Ok(Json(serde_json::json!({
        "message": "Track removed from playlist"
    })))
}