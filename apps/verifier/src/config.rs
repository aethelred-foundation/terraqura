use std::env;
use std::net::{IpAddr, Ipv4Addr};

/// Server configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    /// Bind address for the HTTP server.
    pub host: IpAddr,
    /// Port for the HTTP server.
    pub port: u16,
    /// Tracing log level filter (e.g. "info", "debug", "trace").
    pub log_level: String,
}

impl Config {
    /// Build configuration from environment variables.
    ///
    /// | Variable              | Default     |
    /// |-----------------------|-------------|
    /// | `VERIFIER_HOST`       | `0.0.0.0`  |
    /// | `VERIFIER_PORT`       | `3400`      |
    /// | `VERIFIER_LOG_LEVEL`  | `info`      |
    pub fn from_env() -> Self {
        let host = env::var("VERIFIER_HOST")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));

        let port = env::var("VERIFIER_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3400u16);

        let log_level = env::var("VERIFIER_LOG_LEVEL").unwrap_or_else(|_| "info".into());

        Self {
            host,
            port,
            log_level,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            port: 3400,
            log_level: "info".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_values() {
        let cfg = Config::default();
        assert_eq!(cfg.port, 3400);
        assert_eq!(cfg.log_level, "info");
    }

    #[test]
    fn from_env_uses_defaults_when_unset() {
        // Clear vars to ensure defaults
        env::remove_var("VERIFIER_HOST");
        env::remove_var("VERIFIER_PORT");
        env::remove_var("VERIFIER_LOG_LEVEL");

        let cfg = Config::from_env();
        assert_eq!(cfg.port, 3400);
        assert_eq!(cfg.log_level, "info");
    }
}
