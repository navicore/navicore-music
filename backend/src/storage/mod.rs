use aws_config::{BehaviorVersion, Region};
use aws_sdk_s3::{Client, presigning::PresigningConfig};
use aws_sdk_s3::config::{Credentials, Builder};
use std::time::Duration;
use anyhow::Result;

pub struct R2Storage {
    client: Client,
    bucket_name: String,
}

impl R2Storage {
    pub async fn new(
        bucket_name: String,
        endpoint_url: Option<String>,
        access_key_id: String,
        secret_access_key: String,
    ) -> Result<Self> {
        let credentials = Credentials::new(
            access_key_id,
            secret_access_key,
            None,
            None,
            "navicore-music",
        );

        let mut config_builder = Builder::new()
            .behavior_version(BehaviorVersion::latest())
            .credentials_provider(credentials)
            .region(Region::new("auto"));

        if let Some(endpoint) = endpoint_url {
            config_builder = config_builder.endpoint_url(endpoint);
        }

        let config = config_builder.build();
        let client = Client::from_conf(config);

        Ok(Self {
            client,
            bucket_name,
        })
    }

    pub async fn generate_presigned_url(
        &self,
        key: &str,
        expiry_seconds: u64,
    ) -> Result<String> {
        let presigning_config = PresigningConfig::expires_in(
            Duration::from_secs(expiry_seconds)
        )?;

        let presigned_request = self.client
            .get_object()
            .bucket(&self.bucket_name)
            .key(key)
            .presigned(presigning_config)
            .await?;

        Ok(presigned_request.uri().to_string())
    }

    pub async fn upload_file(
        &self,
        key: &str,
        body: Vec<u8>,
        content_type: Option<&str>,
    ) -> Result<()> {
        let mut request = self.client
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(body.into());

        if let Some(ct) = content_type {
            request = request.content_type(ct);
        }

        request.send().await?;
        Ok(())
    }

    pub async fn delete_file(&self, key: &str) -> Result<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await?;

        Ok(())
    }

    pub async fn file_exists(&self, key: &str) -> Result<bool> {
        match self.client
            .head_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}