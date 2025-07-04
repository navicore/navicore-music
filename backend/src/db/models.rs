use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: i32,
    pub file_path: String,
    pub cover_art_path: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub track_number: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlaylistTrack {
    pub playlist_id: String,
    pub track_id: String,
    pub position: i32,
    pub added_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub is_admin: bool,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlayHistory {
    pub id: i64,
    pub track_id: String,
    pub user_id: Option<String>,
    pub played_at: DateTime<Utc>,
    pub play_duration: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTrack {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: i32,
    pub file_path: String,
    pub cover_art_path: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub track_number: Option<i32>,
}

impl CreateTrack {
    pub fn into_track(self) -> Track {
        let now = Utc::now();
        Track {
            id: Uuid::new_v4().to_string(),
            title: self.title,
            artist: self.artist,
            album: self.album,
            duration: self.duration,
            file_path: self.file_path,
            cover_art_path: self.cover_art_path,
            genre: self.genre,
            year: self.year,
            track_number: self.track_number,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePlaylist {
    pub name: String,
    pub description: Option<String>,
}

impl CreatePlaylist {
    pub fn into_playlist(self) -> Playlist {
        let now = Utc::now();
        Playlist {
            id: Uuid::new_v4().to_string(),
            name: self.name,
            description: self.description,
            created_at: now,
            updated_at: now,
        }
    }
}