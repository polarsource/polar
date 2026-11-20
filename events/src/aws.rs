use aws_config::{BehaviorVersion, Region, SdkConfig};
use aws_credential_types::Credentials;
use aws_smithy_http_client::tls::{Provider, rustls_provider::CryptoMode};

pub struct AwsSettings {
    pub region: String,
    pub static_credentials: Option<(String, String)>,
}

pub async fn sdk_config(settings: &AwsSettings) -> SdkConfig {
    let http_client = aws_smithy_http_client::Builder::new()
        .tls_provider(Provider::Rustls(CryptoMode::Ring))
        .build_https();
    let mut loader = aws_config::defaults(BehaviorVersion::latest())
        .region(Region::new(settings.region.clone()))
        .http_client(http_client);
    if let Some((access_key_id, secret_access_key)) = &settings.static_credentials {
        loader = loader.credentials_provider(Credentials::new(
            access_key_id,
            secret_access_key,
            None,
            None,
            "polar",
        ));
    }
    loader.load().await
}
