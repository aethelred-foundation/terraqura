package api

// RuntimeInfo describes the environment the indexer process resolved at boot.
type RuntimeInfo struct {
	NetworkKey          string `json:"network_key,omitempty"`
	DeploymentKey       string `json:"deployment_key,omitempty"`
	ChainID             int64  `json:"chain_id,omitempty"`
	ManifestPath        string `json:"manifest_path,omitempty"`
	StoreBackend        string `json:"store_backend,omitempty"`
	IndexerEnabled      bool   `json:"indexer_enabled"`
	ContractFilterCount int    `json:"contract_filter_count"`
	Confirmations       uint64 `json:"confirmations"`
}
