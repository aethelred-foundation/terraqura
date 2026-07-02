export interface FAQItem {
  q: string;
  a: string;
}

export const homeFaqs: FAQItem[] = [
  {
    q: "What is the Aethelred Protocol?",
    a: "TerraQura's sovereign blockchain infrastructure purpose-built for enterprise carbon verification. Sub-second finality, gasless transactions, and full data sovereignty powering our Proof-of-Physics engine.",
  },
  {
    q: "What is Proof-of-Physics?",
    a: "Our proprietary verification engine that validates carbon capture claims against physical constraints. It checks energy consumption (200-600 kWh/tonne range), flow rates, and conditions. If the physics don't add up, the credit is rejected.",
  },
  {
    q: "How is TerraQura different?",
    a: "Legacy registries rely on self-reported data and quarterly manual audits. TerraQura uses real-time IoT sensors, a sovereign oracle, satellite cross-verification, and on-chain mathematical validation. Every credit is publicly verifiable.",
  },
  {
    q: "Can enterprises buy without crypto?",
    a: "Yes. Our gasless settlement system using ERC-2771 meta-transactions enables purchase via standard invoices and wire transfers. The blockchain interaction is fully abstracted.",
  },
  {
    q: "Why build a sovereign chain?",
    a: "Aethelred's security, performance, and governance are optimized specifically for carbon verification. Sub-second finality, gasless transactions, and full data sovereignty, purpose-built for enterprise carbon assets.",
  },
  {
    q: "What is the regulatory status?",
    a: "TerraQura is headquartered in Abu Dhabi. Incorporating under ADGM with full KYC/AML compliance via Sumsub and UAE data residency.",
  },
  {
    q: "How are smart contracts secured?",
    a: "UUPS upgradeable proxy pattern with OpenZeppelin standards, multi-sig wallet with timelock delays, and circuit breakers. Tier-1 security audit before mainnet launch.",
  },
  {
    q: "When does the protocol launch?",
    a: "Testnet targeted for Q3 2026. Currently in smart contract development. Mainnet with institutional pilots follows the validation period. Actively engaging enterprise partners.",
  },
  {
    q: "What types of carbon credits does TerraQura support?",
    a: "TerraQura focuses exclusively on Direct Air Capture (DAC) carbon removal credits. Unlike nature-based offsets that rely on estimates and projections, DAC produces measurable, verifiable removal data that our Proof-of-Physics engine can validate in real-time.",
  },
  {
    q: "How does satellite cross-verification work?",
    a: "Satellite imagery provides an independent verification layer alongside IoT sensor data. We cross-reference facility operational status, thermal signatures, and environmental conditions against reported capture data to detect anomalies and ensure data integrity.",
  },
];
