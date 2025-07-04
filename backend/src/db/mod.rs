use sqlx::{sqlite::SqlitePool, Pool, Sqlite};

pub mod models;
pub mod queries;

pub type DbPool = Pool<Sqlite>;

pub async fn create_pool(database_url: &str) -> anyhow::Result<DbPool> {
    let pool = SqlitePool::connect(database_url)
        .await?;
    
    Ok(pool)
}