use super::models::*;
use super::DbPool;
use sqlx::{query, query_as};

pub async fn get_all_tracks(pool: &DbPool) -> anyhow::Result<Vec<Track>> {
    let tracks = query_as::<_, Track>(
        r#"
        SELECT id, title, artist, album, duration, file_path, cover_art_path, 
               genre, year, track_number, created_at, updated_at
        FROM tracks
        ORDER BY artist, album, track_number
        "#
    )
    .fetch_all(pool)
    .await?;
    
    Ok(tracks)
}

pub async fn get_track_by_id(pool: &DbPool, id: &str) -> anyhow::Result<Option<Track>> {
    let track = query_as::<_, Track>(
        r#"
        SELECT id, title, artist, album, duration, file_path, cover_art_path, 
               genre, year, track_number, created_at, updated_at
        FROM tracks
        WHERE id = ?
        "#
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    
    Ok(track)
}

pub async fn create_track(pool: &DbPool, track: Track) -> anyhow::Result<Track> {
    query(
        r#"
        INSERT INTO tracks (id, title, artist, album, duration, file_path, 
                          cover_art_path, genre, year, track_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&track.id)
    .bind(&track.title)
    .bind(&track.artist)
    .bind(&track.album)
    .bind(&track.duration)
    .bind(&track.file_path)
    .bind(&track.cover_art_path)
    .bind(&track.genre)
    .bind(&track.year)
    .bind(&track.track_number)
    .bind(&track.created_at)
    .bind(&track.updated_at)
    .execute(pool)
    .await?;
    
    Ok(track)
}

pub async fn delete_track(pool: &DbPool, id: &str) -> anyhow::Result<bool> {
    let result = query(r#"DELETE FROM tracks WHERE id = ?"#)
        .bind(id)
        .execute(pool)
        .await?;
    
    Ok(result.rows_affected() > 0)
}

pub async fn search_tracks(
    pool: &DbPool,
    search_query: &str,
) -> anyhow::Result<Vec<Track>> {
    let search_term = format!("%{}%", search_query);
    let tracks = query_as::<_, Track>(
        r#"
        SELECT id, title, artist, album, duration, file_path, cover_art_path, 
               genre, year, track_number, created_at, updated_at
        FROM tracks
        WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
        ORDER BY artist, album, track_number
        "#
    )
    .bind(&search_term)
    .bind(&search_term)
    .bind(&search_term)
    .fetch_all(pool)
    .await?;
    
    Ok(tracks)
}

pub async fn get_all_playlists(pool: &DbPool) -> anyhow::Result<Vec<Playlist>> {
    let playlists = query_as::<_, Playlist>(
        r#"
        SELECT id, name, description, created_at, updated_at
        FROM playlists
        ORDER BY name
        "#
    )
    .fetch_all(pool)
    .await?;
    
    Ok(playlists)
}

pub async fn get_playlist_by_id(pool: &DbPool, id: &str) -> anyhow::Result<Option<Playlist>> {
    let playlist = query_as::<_, Playlist>(
        r#"
        SELECT id, name, description, created_at, updated_at
        FROM playlists
        WHERE id = ?
        "#
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    
    Ok(playlist)
}

pub async fn create_playlist(pool: &DbPool, playlist: Playlist) -> anyhow::Result<Playlist> {
    query(
        r#"
        INSERT INTO playlists (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        "#
    )
    .bind(&playlist.id)
    .bind(&playlist.name)
    .bind(&playlist.description)
    .bind(&playlist.created_at)
    .bind(&playlist.updated_at)
    .execute(pool)
    .await?;
    
    Ok(playlist)
}

pub async fn get_playlist_tracks(pool: &DbPool, playlist_id: &str) -> anyhow::Result<Vec<Track>> {
    let tracks = query_as::<_, Track>(
        r#"
        SELECT t.id, t.title, t.artist, t.album, t.duration, t.file_path, 
               t.cover_art_path, t.genre, t.year, t.track_number, 
               t.created_at, t.updated_at
        FROM tracks t
        INNER JOIN playlist_tracks pt ON t.id = pt.track_id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position
        "#
    )
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;
    
    Ok(tracks)
}

pub async fn add_track_to_playlist(
    pool: &DbPool,
    playlist_id: &str,
    track_id: &str,
    position: i32,
) -> anyhow::Result<()> {
    query(
        r#"
        INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        "#
    )
    .bind(playlist_id)
    .bind(track_id)
    .bind(position)
    .execute(pool)
    .await?;
    
    Ok(())
}

pub async fn remove_track_from_playlist(
    pool: &DbPool,
    playlist_id: &str,
    track_id: &str,
) -> anyhow::Result<bool> {
    let result = query(
        r#"
        DELETE FROM playlist_tracks 
        WHERE playlist_id = ? AND track_id = ?
        "#
    )
    .bind(playlist_id)
    .bind(track_id)
    .execute(pool)
    .await?;
    
    Ok(result.rows_affected() > 0)
}

pub async fn record_play(
    pool: &DbPool,
    track_id: &str,
    user_id: Option<&str>,
    duration: Option<i32>,
) -> anyhow::Result<()> {
    query(
        r#"
        INSERT INTO play_history (track_id, user_id, play_duration, played_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        "#
    )
    .bind(track_id)
    .bind(user_id)
    .bind(duration)
    .execute(pool)
    .await?;
    
    Ok(())
}