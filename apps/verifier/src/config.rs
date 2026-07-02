use serde::Deserialize;
use std::env;
use std::fs;
use std::net::{IpAddr, Ipv4Addr};
use std::path::PathBuf;

const LEGACY_VALIDATION_OPT_IN_ENV: &str = "TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT";
const PUBLIC_LEGACY_VALIDATION_OPT_IN_ENV: &str =
    "NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT";

/// Server configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    /// Bind address for the HTTP server.
    pub host: IpAddr,
    /// Port for the HTTP server.
    pub port: u16,
    /// Tracing log level filter (e.g. "info", "debug", "trace").
    pub log_level: String,
    /// Canonical TerraQura network key from the portable manifest.
    pub network_key: String,
    /// Canonical TerraQura deployment key from the portable manifest.
    pub deployment_key: String,
    /// EVM chain ID for the selected TerraQura network.
    pub chain_id: u64,
    /// Path to the portable manifest used to resolve network identity.
    pub network_manifest_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PortableManifest {
    #[serde(rename = "primaryNetworkKey")]
    primary_network_key: String,
    networks: std::collections::HashMap<String, ManifestNetwork>,
    deployments: std::collections::HashMap<String, ManifestDeployment>,
}

#[derive(Debug, Deserialize)]
struct ManifestNetwork {
    #[serde(rename = "chainId")]
    chain_id: u64,
    #[serde(default)]
    role: String,
}

#[derive(Debug, Deserialize)]
struct ManifestDeployment {
    network: String,
}

impl Config {
    /// Build configuration from environment variables.
    ///
    /// | Variable                           | Default                  |
    /// |------------------------------------|--------------------------|
    /// | `VERIFIER_HOST`                    | `0.0.0.0`                |
    /// | `VERIFIER_PORT`                    | `3400`                   |
    /// | `VERIFIER_LOG_LEVEL`               | `info`                   |
    /// | `TERRAQURA_NETWORK`                | manifest primary network |
    /// | `TERRAQURA_DEPLOYMENT`             | network deployment       |
    /// | `TERRAQURA_NETWORK_MANIFEST_JSON`  | repo manifest candidate  |
    pub fn try_from_env() -> Result<Self, String> {
        let host = env::var("VERIFIER_HOST")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));

        let port = env::var("VERIFIER_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3400u16);

        let log_level = env::var("VERIFIER_LOG_LEVEL").unwrap_or_else(|_| "info".into());

        let (manifest, manifest_path) = load_manifest();
        let network_key = env::var("TERRAQURA_NETWORK").ok().unwrap_or_else(|| {
            manifest
                .as_ref()
                .map(|m| m.primary_network_key.clone())
                .unwrap_or_else(|| "aethelred".into())
        });

        let deployment_key = env::var("TERRAQURA_DEPLOYMENT")
            .ok()
            .or_else(|| {
                manifest
                    .as_ref()
                    .and_then(|m| m.deployment_for_network(&network_key))
            })
            .unwrap_or_else(|| "aethelredMainnetPending".into());

        let manifest_chain_id = if let Some(manifest) = manifest.as_ref() {
            let network = manifest
                .networks
                .get(&network_key)
                .ok_or_else(|| format!("unknown TerraQura network {network_key:?}"))?;
            assert_runtime_network_allowed(&network_key, network)?;

            let deployment = manifest
                .deployments
                .get(&deployment_key)
                .ok_or_else(|| format!("unknown TerraQura deployment {deployment_key:?}"))?;
            if deployment.network != network_key {
                return Err(format!(
                    "deployment {deployment_key:?} belongs to {:?}, not {network_key:?}",
                    deployment.network
                ));
            }

            network.chain_id
        } else {
            7331
        };

        let chain_id = env::var("TERRAQURA_CHAIN_ID")
            .or_else(|_| env::var("CHAIN_ID"))
            .ok()
            .map(|raw| {
                raw.parse::<u64>()
                    .map_err(|err| format!("chain ID must be an integer: {err}"))
            })
            .transpose()?
            .unwrap_or(manifest_chain_id);

        if chain_id != manifest_chain_id {
            return Err(format!(
                "configured chain ID {chain_id} does not match network {network_key:?} chain ID {manifest_chain_id}"
            ));
        }

        Ok(Self {
            host,
            port,
            log_level,
            network_key,
            deployment_key,
            chain_id,
            network_manifest_path: manifest_path,
        })
    }

    pub fn from_env() -> Self {
        Self::try_from_env()
            .unwrap_or_else(|err| panic!("invalid TerraQura verifier config: {err}"))
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            port: 3400,
            log_level: "info".into(),
            network_key: "aethelred".into(),
            deployment_key: "aethelredMainnetPending".into(),
            chain_id: 7331,
            network_manifest_path: None,
        }
    }
}

impl PortableManifest {
    fn deployment_for_network(&self, network_key: &str) -> Option<String> {
        self.deployments
            .iter()
            .find_map(|(deployment_key, deployment)| {
                if deployment.network == network_key {
                    Some(deployment_key.clone())
                } else {
                    None
                }
            })
    }
}

fn assert_runtime_network_allowed(
    network_key: &str,
    network: &ManifestNetwork,
) -> Result<(), String> {
    if network.role != "legacy-validation" {
        return Ok(());
    }
    if legacy_validation_opt_in_enabled() {
        return Ok(());
    }
    Err(format!(
        "network {network_key:?} is marked as legacy validation evidence; set {LEGACY_VALIDATION_OPT_IN_ENV}=true only for historical validation drills"
    ))
}

fn legacy_validation_opt_in_enabled() -> bool {
    env::var(LEGACY_VALIDATION_OPT_IN_ENV).as_deref() == Ok("true")
        || env::var(PUBLIC_LEGACY_VALIDATION_OPT_IN_ENV).as_deref() == Ok("true")
}

fn load_manifest() -> (Option<PortableManifest>, Option<String>) {
    for candidate in manifest_candidates() {
        let Ok(data) = fs::read_to_string(&candidate) else {
            continue;
        };
        let Ok(manifest) = serde_json::from_str::<PortableManifest>(&data) else {
            continue;
        };
        return (Some(manifest), Some(candidate.display().to_string()));
    }

    (None, None)
}

fn manifest_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(path) = env::var("TERRAQURA_NETWORK_MANIFEST_JSON") {
        candidates.push(PathBuf::from(path));
    }

    candidates.extend([
        PathBuf::from("packages/network-manifest/manifest.json"),
        PathBuf::from("../../packages/network-manifest/manifest.json"),
        PathBuf::from("../../../packages/network-manifest/manifest.json"),
    ]);

    candidates
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn default_config_values() {
        let cfg = Config::default();
        assert_eq!(cfg.port, 3400);
        assert_eq!(cfg.log_level, "info");
        assert_eq!(cfg.network_key, "aethelred");
        assert_eq!(cfg.deployment_key, "aethelredMainnetPending");
        assert_eq!(cfg.chain_id, 7331);
    }

    #[test]
    fn from_env_uses_manifest_defaults_when_unset() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();

        let cfg = Config::try_from_env().unwrap();
        assert_eq!(cfg.port, 3400);
        assert_eq!(cfg.log_level, "info");
        assert_eq!(cfg.network_key, "aethelred");
        assert_eq!(cfg.deployment_key, "aethelredMainnetPending");
        assert_eq!(cfg.chain_id, 7331);
    }

    #[test]
    fn from_env_supports_testnet_network() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        env::set_var("TERRAQURA_NETWORK", "aethelredTestnet");

        let cfg = Config::try_from_env().unwrap();
        assert_eq!(cfg.network_key, "aethelredTestnet");
        assert_eq!(cfg.deployment_key, "aethelredTestnetPending");
        assert_eq!(cfg.chain_id, 7332);
    }

    #[test]
    fn from_env_rejects_chain_id_drift() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        env::set_var("TERRAQURA_NETWORK", "aethelredTestnet");
        env::set_var("TERRAQURA_CHAIN_ID", "7331");

        let err = Config::try_from_env().unwrap_err();
        assert!(err.contains("does not match"));
    }

    #[test]
    fn from_env_rejects_legacy_validation_network_without_opt_in() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        env::set_var("TERRAQURA_NETWORK", "polygonAmoy");

        let err = Config::try_from_env().unwrap_err();
        assert!(err.contains("legacy validation evidence"));
    }

    #[test]
    fn from_env_allows_legacy_validation_network_with_explicit_opt_in() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        env::set_var("TERRAQURA_NETWORK", "polygonAmoy");
        env::set_var(LEGACY_VALIDATION_OPT_IN_ENV, "true");

        let cfg = Config::try_from_env().unwrap();
        assert_eq!(cfg.network_key, "polygonAmoy");
        assert_eq!(cfg.deployment_key, "polygonAmoyV3Final");
        assert_eq!(cfg.chain_id, 80002);
    }

    fn clear_env() {
        for key in [
            "TERRAQURA_NETWORK",
            "TERRAQURA_DEPLOYMENT",
            "TERRAQURA_CHAIN_ID",
            "CHAIN_ID",
            "VERIFIER_HOST",
            "VERIFIER_PORT",
            "VERIFIER_LOG_LEVEL",
            LEGACY_VALIDATION_OPT_IN_ENV,
            PUBLIC_LEGACY_VALIDATION_OPT_IN_ENV,
        ] {
            env::remove_var(key);
        }
    }
}
