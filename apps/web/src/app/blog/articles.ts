export type ArticleCategory = "Technology" | "Research" | "Industry";

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  category: ArticleCategory;
  author: string;
  tags: string[];
}

export const articles: Article[] = [
  {
    slug: "what-is-proof-of-physics",
    title: "What Is Proof-of-Physics? The Verification Standard Carbon Markets Need",
    excerpt:
      "Traditional MRV systems rely on manual audits and self-reported data, creating a trust deficit in carbon markets. Proof-of-Physics replaces estimation with mathematical certainty through real-time IoT sensor validation.",
    date: "February 24, 2026",
    readingTime: "12 min read",
    category: "Technology",
    author: "TerraQura Research",
    tags: ["Proof-of-Physics", "MRV", "Verification", "IoT Sensors", "Carbon Credits", "Thermodynamics", "On-Chain"],
  },
  {
    slug: "understanding-direct-air-capture",
    title: "Understanding Direct Air Capture: The Science Behind Pulling CO2 from Thin Air",
    excerpt:
      "Direct Air Capture technology removes CO2 directly from the atmosphere using chemical processes. We examine the science, energy requirements, costs, and the path to gigaton-scale deployment.",
    date: "February 21, 2026",
    readingTime: "14 min read",
    category: "Research",
    author: "TerraQura Research",
    tags: ["Direct Air Capture", "DAC", "Carbon Removal", "Solid Sorbent", "Liquid Solvent", "Climate Science", "Net Zero", "Gigaton Scale"],
  },
  {
    slug: "why-blockchain-matters-for-carbon-credits",
    title: "Why Blockchain Matters for Carbon Credits: Solving the Double-Counting Problem",
    excerpt:
      "Double-counting has undermined billions of dollars in carbon offsets. Blockchain-based registries create an immutable, transparent ledger that makes every credit uniquely traceable from creation to retirement.",
    date: "February 18, 2026",
    readingTime: "11 min read",
    category: "Technology",
    author: "TerraQura Research",
    tags: ["Blockchain", "Double Counting", "ERC-1155", "Carbon Registry", "Transparency", "Tokenization", "Smart Contracts"],
  },
  {
    slug: "voluntary-carbon-market-2026",
    title: "The Voluntary Carbon Market in 2026: Trends, Challenges, and Opportunities",
    excerpt:
      "The voluntary carbon market has grown past $2 billion, but quality concerns and regulatory fragmentation threaten its trajectory. We analyze the forces reshaping carbon credit demand and supply.",
    date: "February 15, 2026",
    readingTime: "13 min read",
    category: "Industry",
    author: "TerraQura Research",
    tags: ["Voluntary Carbon Market", "VCM", "Carbon Pricing", "ESG", "ICVCM", "Compliance", "Market Analysis", "Corporate Sustainability"],
  },
  {
    slug: "aethelred-sovereign-blockchain",
    title: "Aethelred: Building a Sovereign Blockchain for Carbon Verification",
    excerpt:
      "Why did TerraQura build its own sovereign chain? We detail the architectural decisions behind Aethelred, our EVM-compatible blockchain purpose-built for institutional carbon verification.",
    date: "February 12, 2026",
    readingTime: "15 min read",
    category: "Technology",
    author: "TerraQura Research",
    tags: ["Aethelred", "Sovereign Blockchain", "EVM", "Layer 1", "Gas Fees", "Validator Network", "Protocol Design", "Infrastructure"],
  },
  {
    slug: "iot-sensor-networks-carbon-monitoring",
    title: "IoT Sensor Networks for Carbon Capture Monitoring: A Technical Deep Dive",
    excerpt:
      "From CO2 flow meters to tamper-resistant edge nodes, the physical layer of Proof-of-Physics determines the integrity of every carbon credit. A comprehensive look at our sensor infrastructure.",
    date: "February 9, 2026",
    readingTime: "13 min read",
    category: "Research",
    author: "TerraQura Research",
    tags: ["IoT", "Sensors", "Edge Computing", "MQTT", "NativeIoT Oracle", "Data Integrity", "Tamper Resistance", "Telemetry"],
  },
  {
    slug: "enterprise-carbon-procurement-guide",
    title: "Enterprise Carbon Procurement: A Guide for Corporate Sustainability Officers",
    excerpt:
      "Navigating the carbon credit landscape as a corporate buyer requires understanding quality frameworks, due diligence processes, and integration with ESG reporting. A practical guide for procurement teams.",
    date: "February 6, 2026",
    readingTime: "11 min read",
    category: "Industry",
    author: "TerraQura Research",
    tags: ["Enterprise", "Procurement", "ESG Reporting", "Due Diligence", "Net Zero", "CSO", "Carbon Offsets", "Compliance"],
  },
  {
    slug: "economics-of-carbon-removal",
    title: "The Economics of Carbon Removal: From $600/tonne to $100/tonne",
    excerpt:
      "Carbon removal costs are following a learning curve similar to solar PV. We analyze the economics, cost drivers, policy incentives, and investment thesis behind the path to affordable carbon removal.",
    date: "February 3, 2026",
    readingTime: "14 min read",
    category: "Research",
    author: "TerraQura Research",
    tags: ["Carbon Economics", "Cost Curve", "Learning Rate", "45Q Tax Credit", "Investment Thesis", "Climate Finance", "Policy", "Scalability"],
  },
  {
    slug: "smart-contract-architecture-carbon-tokenization",
    title: "Smart Contract Architecture for Carbon Credit Tokenization",
    excerpt:
      "A technical walkthrough of TerraQura's smart contract stack: ERC-1155 multi-token design, role-based access control, on-chain verification, and gasless marketplace settlement.",
    date: "January 30, 2026",
    readingTime: "16 min read",
    category: "Technology",
    author: "TerraQura Research",
    tags: ["Smart Contracts", "Solidity", "ERC-1155", "UUPS Proxy", "ERC-2771", "Gasless", "Marketplace", "Access Control", "Architecture"],
  },
  {
    slug: "abu-dhabi-climate-tech-vision",
    title: "Abu Dhabi's Climate Tech Vision: How the UAE Is Leading Carbon Innovation",
    excerpt:
      "From the UAE Net Zero 2050 strategy to ADGM regulatory sandboxes and Masdar City, Abu Dhabi is positioning itself as the global hub for climate technology and carbon market infrastructure.",
    date: "January 27, 2026",
    readingTime: "12 min read",
    category: "Industry",
    author: "TerraQura Research",
    tags: ["Abu Dhabi", "UAE", "ADGM", "Masdar City", "Net Zero 2050", "Climate Policy", "Regulatory Sandbox", "GCC", "Sovereign Wealth"],
  },
];

export const categoryColors: Record<ArticleCategory, string> = {
  Technology: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Research: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Industry: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
