use worker::*;
use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct Track {
    id: String,
    title: String,
    artist: String,
    album: String,
    duration: i32,
    file_path: String,
    cover_art_path: Option<String>,
    genre: Option<String>,
    year: Option<i32>,
    track_number: Option<i32>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateTrackRequest {
    title: String,
    artist: String,
    album: String,
    duration: i32,
    file_path: String,
    cover_art_path: Option<String>,
    genre: Option<String>,
    year: Option<i32>,
    track_number: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrackListResponse {
    tracks: Vec<Track>,
    count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct StreamUrlResponse {
    url: String,
    expires_in: u64,
}

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let router = Router::new();
    
    router
        .get("/", |_, _| Response::ok("Navicore Music API - Worker Edition"))
        .get("/health", health_handler)
        .get("/api/v1/tracks", list_tracks_handler)
        .post("/api/v1/tracks", create_track_handler)
        .get("/api/v1/tracks/:id", get_track_handler)
        .delete("/api/v1/tracks/:id", delete_track_handler)
        .get("/api/v1/tracks/:id/stream", get_stream_url_handler)
        .run(req, env)
        .await
}

async fn health_handler(_: Request, env: Env, _: Context) -> Result<Response> {
    let db_connected = env.d1("DB").is_ok();
    let r2_connected = env.bucket("MUSIC_BUCKET").is_ok();
    
    Response::from_json(&serde_json::json!({
        "status": "healthy",
        "service": "navicore-music-api",
        "timestamp": Utc::now().to_rfc3339(),
        "environment": env.var("ENVIRONMENT").unwrap_or_else(|_| "production".to_string()).to_string(),
        "bindings": {
            "db": if db_connected { "connected" } else { "not connected" },
            "r2": if r2_connected { "connected" } else { "not connected" }
        }
    }))
}

async fn list_tracks_handler(req: Request, env: Env, _: Context) -> Result<Response> {
    let url = req.url()?;
    let query = url.query();
    
    let db = env.d1("DB")?;
    
    let statement = if let Some(q) = query {
        let search_term = format!("%{}%", q);
        db.prepare("SELECT * FROM tracks WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 ORDER BY artist, album, track_number")
            .bind(&[search_term.into()])?
    } else {
        db.prepare("SELECT * FROM tracks ORDER BY artist, album, track_number")
    };
    
    let results = statement.all().await?;
    let tracks: Vec<Track> = results
        .results::<serde_json::Value>()?
        .into_iter()
        .filter_map(|row| {
            Some(Track {
                id: row.get("id")?.as_str()?.to_string(),
                title: row.get("title")?.as_str()?.to_string(),
                artist: row.get("artist")?.as_str()?.to_string(),
                album: row.get("album")?.as_str()?.to_string(),
                duration: row.get("duration")?.as_i64()? as i32,
                file_path: row.get("file_path")?.as_str()?.to_string(),
                cover_art_path: row.get("cover_art_path").and_then(|v| v.as_str()).map(String::from),
                genre: row.get("genre").and_then(|v| v.as_str()).map(String::from),
                year: row.get("year").and_then(|v| v.as_i64()).map(|v| v as i32),
                track_number: row.get("track_number").and_then(|v| v.as_i64()).map(|v| v as i32),
                created_at: row.get("created_at")?.as_str()?.to_string(),
                updated_at: row.get("updated_at")?.as_str()?.to_string(),
            })
        })
        .collect();
    
    let count = tracks.len();
    Response::from_json(&TrackListResponse { tracks, count })
}

async fn create_track_handler(mut req: Request, env: Env, _: Context) -> Result<Response> {
    let create_req: CreateTrackRequest = req.json().await?;
    let db = env.d1("DB")?;
    
    let track = Track {
        id: Uuid::new_v4().to_string(),
        title: create_req.title,
        artist: create_req.artist,
        album: create_req.album,
        duration: create_req.duration,
        file_path: create_req.file_path,
        cover_art_path: create_req.cover_art_path,
        genre: create_req.genre,
        year: create_req.year,
        track_number: create_req.track_number,
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };
    
    db.prepare(
        "INSERT INTO tracks (id, title, artist, album, duration, file_path, cover_art_path, genre, year, track_number, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    )
    .bind(&[
        track.id.clone().into(),
        track.title.clone().into(),
        track.artist.clone().into(),
        track.album.clone().into(),
        track.duration.into(),
        track.file_path.clone().into(),
        track.cover_art_path.clone().into(),
        track.genre.clone().into(),
        track.year.into(),
        track.track_number.into(),
        track.created_at.clone().into(),
        track.updated_at.clone().into(),
    ])?
    .run()
    .await?;
    
    Response::from_json(&track)
}

async fn get_track_handler(_: Request, env: Env, ctx: Context) -> Result<Response> {
    let id = ctx.param("id").unwrap_or_default();
    let db = env.d1("DB")?;
    
    let result = db.prepare("SELECT * FROM tracks WHERE id = ?1")
        .bind(&[id.into()])?
        .first::<serde_json::Value>(None)
        .await?;
    
    match result {
        Some(row) => {
            let track = Track {
                id: row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                title: row.get("title").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                artist: row.get("artist").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                album: row.get("album").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                duration: row.get("duration").and_then(|v| v.as_i64()).unwrap_or_default() as i32,
                file_path: row.get("file_path").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                cover_art_path: row.get("cover_art_path").and_then(|v| v.as_str()).map(String::from),
                genre: row.get("genre").and_then(|v| v.as_str()).map(String::from),
                year: row.get("year").and_then(|v| v.as_i64()).map(|v| v as i32),
                track_number: row.get("track_number").and_then(|v| v.as_i64()).map(|v| v as i32),
                created_at: row.get("created_at").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                updated_at: row.get("updated_at").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            };
            Response::from_json(&track)
        }
        None => Response::error("Track not found", 404)
    }
}

async fn delete_track_handler(_: Request, env: Env, ctx: Context) -> Result<Response> {
    let id = ctx.param("id").unwrap_or_default();
    let db = env.d1("DB")?;
    
    let result = db.prepare("DELETE FROM tracks WHERE id = ?1")
        .bind(&[id.into()])?
        .run()
        .await?;
    
    if result.meta().unwrap_or_default().rows_written > 0 {
        Response::from_json(&serde_json::json!({
            "message": "Track deleted successfully"
        }))
    } else {
        Response::error("Track not found", 404)
    }
}

async fn get_stream_url_handler(_: Request, env: Env, ctx: Context) -> Result<Response> {
    let track_id = ctx.param("id").unwrap_or_default();
    let db = env.d1("DB")?;
    
    // Get track file path
    let result = db.prepare("SELECT file_path FROM tracks WHERE id = ?1")
        .bind(&[track_id.into()])?
        .first::<serde_json::Value>(None)
        .await?;
    
    match result {
        Some(row) => {
            let file_path = row.get("file_path").and_then(|v| v.as_str()).unwrap_or_default();
            let bucket = env.bucket("MUSIC_BUCKET")?;
            
            // Generate presigned URL (1 hour expiry)
            let expires_in = 3600;
            let url = format!("https://r2-presigned-url/{}", file_path); // TODO: Implement actual R2 presigned URL
            
            Response::from_json(&StreamUrlResponse {
                url,
                expires_in,
            })
        }
        None => Response::error("Track not found", 404)
    }
}