// TerraQura Graph Client
// Fast blockchain data queries via The Graph

export interface GraphConfig {
  subgraphUrl: string;
  fallbackUrls?: string[];
  timeout?: number;
}

export interface CarbonCredit {
  id: string;
  tokenId: string;
  owner: {
    id: string;
  };
  amount: string;
  vintage: number;
  status: string;
  co2Captured: string;
  energyUsed: string;
  efficiencyFactor: string;
  mintedAt: string;
  mintTxHash: string;
  dataHash: string;
  ipfsCid?: string;
  retiredAt?: string;
  retirementReason?: string;
}

export interface User {
  id: string;
  totalCreditsOwned: string;
  totalCreditsRetired: string;
  totalCreditsMinted: string;
  totalVolumeBought: string;
  totalVolumeSold: string;
  totalCO2Captured: string;
  isKycVerified: boolean;
  firstSeen: string;
  lastActive: string;
}

export interface Listing {
  id: string;
  listingId: string;
  seller: { id: string };
  tokenId: string;
  amount: string;
  amountRemaining: string;
  pricePerUnit: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
}

export interface MarketStats {
  totalCreditsMinted: string;
  totalCreditsRetired: string;
  totalCreditsActive: string;
  totalVolumeTraded: string;
  totalTransactions: number;
  totalUsers: number;
  activeListings: number;
  totalCO2Captured: string;
  totalCO2Retired: string;
}

export interface DailyStats {
  id: string;
  date: number;
  creditsMinted: string;
  creditsRetired: string;
  volumeTraded: string;
  tradeTransactions: number;
}

export interface VerificationBatch {
  id: string;
  operator: { id: string };
  co2Amount: string;
  efficiencyFactor: string;
  status: string;
  passed: boolean;
  submittedAt: string;
  completedAt?: string;
}

export class GraphClient {
  private subgraphUrl: string;
  private fallbackUrls: string[];
  private timeout: number;

  constructor(config: GraphConfig) {
    this.subgraphUrl = config.subgraphUrl;
    this.fallbackUrls = config.fallbackUrls || [];
    this.timeout = config.timeout || 10000;
  }

  /**
   * Execute GraphQL query with fallback support
   */
  private async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const urls = [this.subgraphUrl, ...this.fallbackUrls];
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = (await response.json()) as {
          data?: T;
          errors?: Array<{ message: string }>;
        };

        if (result.errors) {
          throw new Error(result.errors[0]?.message ?? "Unknown graph error");
        }

        return result.data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Graph query failed for ${url}:`, lastError.message);
      }
    }

    throw lastError || new Error("All subgraph endpoints failed");
  }

  // ============================================
  // CREDIT QUERIES
  // ============================================

  async getCreditById(tokenId: string): Promise<CarbonCredit | null> {
    const result = await this.query<{ carbonCredit: CarbonCredit | null }>(`
      query GetCredit($id: ID!) {
        carbonCredit(id: $id) {
          id
          tokenId
          owner { id }
          amount
          vintage
          status
          co2Captured
          energyUsed
          efficiencyFactor
          mintedAt
          mintTxHash
          dataHash
          ipfsCid
          retiredAt
          retirementReason
        }
      }
    `, { id: tokenId });

    return result.carbonCredit;
  }

  async getCreditsByOwner(
    ownerAddress: string,
    first = 100,
    skip = 0
  ): Promise<CarbonCredit[]> {
    const result = await this.query<{ carbonCredits: CarbonCredit[] }>(`
      query GetOwnerCredits($owner: String!, $first: Int!, $skip: Int!) {
        carbonCredits(
          where: { owner: $owner, status_not: "RETIRED" }
          first: $first
          skip: $skip
          orderBy: mintedAt
          orderDirection: desc
        ) {
          id
          tokenId
          owner { id }
          amount
          vintage
          status
          co2Captured
          efficiencyFactor
          mintedAt
          mintTxHash
        }
      }
    `, { owner: ownerAddress.toLowerCase(), first, skip });

    return result.carbonCredits;
  }

  async getRecentCredits(first = 50): Promise<CarbonCredit[]> {
    const result = await this.query<{ carbonCredits: CarbonCredit[] }>(`
      query GetRecentCredits($first: Int!) {
        carbonCredits(
          first: $first
          orderBy: mintedAt
          orderDirection: desc
        ) {
          id
          tokenId
          owner { id }
          amount
          vintage
          status
          co2Captured
          efficiencyFactor
          mintedAt
        }
      }
    `, { first });

    return result.carbonCredits;
  }

  // ============================================
  // USER QUERIES
  // ============================================

  async getUser(address: string): Promise<User | null> {
    const result = await this.query<{ user: User | null }>(`
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          totalCreditsOwned
          totalCreditsRetired
          totalCreditsMinted
          totalVolumeBought
          totalVolumeSold
          totalCO2Captured
          isKycVerified
          firstSeen
          lastActive
        }
      }
    `, { id: address.toLowerCase() });

    return result.user;
  }

  async getTopHolders(first = 20): Promise<User[]> {
    const result = await this.query<{ users: User[] }>(`
      query GetTopHolders($first: Int!) {
        users(
          first: $first
          orderBy: totalCreditsOwned
          orderDirection: desc
          where: { totalCreditsOwned_gt: "0" }
        ) {
          id
          totalCreditsOwned
          totalCO2Captured
          isKycVerified
        }
      }
    `, { first });

    return result.users;
  }

  // ============================================
  // MARKETPLACE QUERIES
  // ============================================

  async getActiveListings(
    first = 100,
    skip = 0,
    orderBy = "createdAt",
    orderDirection = "desc"
  ): Promise<Listing[]> {
    const result = await this.query<{ listings: Listing[] }>(`
      query GetListings($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
        listings(
          where: { status: "ACTIVE" }
          first: $first
          skip: $skip
          orderBy: $orderBy
          orderDirection: $orderDirection
        ) {
          id
          listingId
          seller { id }
          tokenId
          amount
          amountRemaining
          pricePerUnit
          status
          createdAt
          expiresAt
        }
      }
    `, { first, skip, orderBy, orderDirection });

    return result.listings;
  }

  async getListingById(listingId: string): Promise<Listing | null> {
    const result = await this.query<{ listing: Listing | null }>(`
      query GetListing($id: ID!) {
        listing(id: $id) {
          id
          listingId
          seller { id }
          tokenId
          amount
          amountRemaining
          pricePerUnit
          status
          createdAt
          expiresAt
        }
      }
    `, { id: listingId });

    return result.listing;
  }

  async getUserListings(sellerAddress: string): Promise<Listing[]> {
    const result = await this.query<{ listings: Listing[] }>(`
      query GetUserListings($seller: String!) {
        listings(
          where: { seller: $seller }
          orderBy: createdAt
          orderDirection: desc
        ) {
          id
          listingId
          tokenId
          amount
          amountRemaining
          pricePerUnit
          status
          createdAt
        }
      }
    `, { seller: sellerAddress.toLowerCase() });

    return result.listings;
  }

  // ============================================
  // STATS QUERIES
  // ============================================

  async getMarketStats(): Promise<MarketStats | null> {
    const result = await this.query<{ marketStats: MarketStats | null }>(`
      query GetMarketStats {
        marketStats(id: "global") {
          totalCreditsMinted
          totalCreditsRetired
          totalCreditsActive
          totalVolumeTraded
          totalTransactions
          totalUsers
          activeListings
          totalCO2Captured
          totalCO2Retired
        }
      }
    `);

    return result.marketStats;
  }

  async getDailyStats(days = 30): Promise<DailyStats[]> {
    const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    const result = await this.query<{ dailyStats: DailyStats[] }>(`
      query GetDailyStats($cutoff: Int!) {
        dailyStats(
          where: { date_gte: $cutoff }
          orderBy: date
          orderDirection: asc
        ) {
          id
          date
          creditsMinted
          creditsRetired
          volumeTraded
          tradeTransactions
        }
      }
    `, { cutoff });

    return result.dailyStats;
  }

  // ============================================
  // VERIFICATION QUERIES
  // ============================================

  async getVerificationBatch(batchId: string): Promise<VerificationBatch | null> {
    const result = await this.query<{ verificationBatch: VerificationBatch | null }>(`
      query GetVerification($id: ID!) {
        verificationBatch(id: $id) {
          id
          operator { id }
          co2Amount
          efficiencyFactor
          status
          passed
          submittedAt
          completedAt
        }
      }
    `, { id: batchId });

    return result.verificationBatch;
  }

  async getOperatorVerifications(
    operatorAddress: string,
    first = 50
  ): Promise<VerificationBatch[]> {
    const result = await this.query<{ verificationBatches: VerificationBatch[] }>(`
      query GetOperatorVerifications($operator: String!, $first: Int!) {
        verificationBatches(
          where: { operator: $operator }
          first: $first
          orderBy: submittedAt
          orderDirection: desc
        ) {
          id
          co2Amount
          efficiencyFactor
          status
          passed
          submittedAt
          completedAt
        }
      }
    `, { operator: operatorAddress.toLowerCase(), first });

    return result.verificationBatches;
  }

  // ============================================
  // SEARCH & FILTER
  // ============================================

  async searchCredits(params: {
    minAmount?: string;
    maxAmount?: string;
    vintage?: number;
    status?: string;
    first?: number;
  }): Promise<CarbonCredit[]> {
    const where: string[] = [];

    if (params.minAmount) {
      where.push(`amount_gte: "${params.minAmount}"`);
    }
    if (params.maxAmount) {
      where.push(`amount_lte: "${params.maxAmount}"`);
    }
    if (params.vintage) {
      where.push(`vintage: ${params.vintage}`);
    }
    if (params.status) {
      where.push(`status: "${params.status}"`);
    }

    const whereClause = where.length > 0 ? `where: { ${where.join(", ")} }` : "";

    const result = await this.query<{ carbonCredits: CarbonCredit[] }>(`
      query SearchCredits {
        carbonCredits(
          ${whereClause}
          first: ${params.first || 100}
          orderBy: mintedAt
          orderDirection: desc
        ) {
          id
          tokenId
          owner { id }
          amount
          vintage
          status
          co2Captured
          efficiencyFactor
          mintedAt
        }
      }
    `);

    return result.carbonCredits;
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck(): Promise<{ healthy: boolean; blockNumber?: number }> {
    try {
      const result = await this.query<{ _meta: { block: { number: number } } }>(`
        query HealthCheck {
          _meta {
            block {
              number
            }
          }
        }
      `);

      return {
        healthy: true,
        blockNumber: result._meta.block.number,
      };
    } catch {
      return { healthy: false };
    }
  }
}

// Singleton factory
let graphClient: GraphClient | null = null;

export function getGraphClient(): GraphClient {
  if (!graphClient) {
    const subgraphUrl = process.env.SUBGRAPH_URL;

    if (!subgraphUrl) {
      throw new Error("SUBGRAPH_URL environment variable is required");
    }

    graphClient = new GraphClient({
      subgraphUrl,
      fallbackUrls: process.env.SUBGRAPH_FALLBACK_URLS?.split(","),
      timeout: parseInt(process.env.SUBGRAPH_TIMEOUT || "10000", 10),
    });
  }

  return graphClient;
}

export default GraphClient;
