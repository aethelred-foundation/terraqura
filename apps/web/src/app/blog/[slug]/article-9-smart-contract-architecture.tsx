"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <div className="text-2xl font-bold text-emerald-400 mb-1">{value}</div>
      <div className="text-xs text-white/50 font-body">{label}</div>
    </div>
  );
}

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#architecture-overview" className="text-emerald-400 hover:text-emerald-300 transition-colors">Architecture Overview</a></li>
        <li><a href="#erc-1155-design" className="text-emerald-400 hover:text-emerald-300 transition-colors">ERC-1155 Design Rationale</a></li>
        <li><a href="#access-control" className="text-emerald-400 hover:text-emerald-300 transition-colors">Access Control Patterns</a></li>
        <li><a href="#verification-engine" className="text-emerald-400 hover:text-emerald-300 transition-colors">Verification Engine Contract</a></li>
        <li><a href="#marketplace" className="text-emerald-400 hover:text-emerald-300 transition-colors">Marketplace Mechanics</a></li>
        <li><a href="#gasless" className="text-emerald-400 hover:text-emerald-300 transition-colors">Gasless Transactions (ERC-2771)</a></li>
        <li><a href="#contract-interactions" className="text-emerald-400 hover:text-emerald-300 transition-colors">Contract Interaction Architecture</a></li>
        <li><a href="#gas-costs" className="text-emerald-400 hover:text-emerald-300 transition-colors">Gas Cost Analysis</a></li>
        <li><a href="#security" className="text-emerald-400 hover:text-emerald-300 transition-colors">Security Considerations</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article9Content() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="article-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <AnimatedSection>
            <div className="mb-6 flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Technology
              </span>
              <span className="text-sm text-white/40 font-body">16 min read</span>
              <span className="text-sm text-white/40 font-body">January 30, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              Smart Contract Architecture for Carbon Credit Tokenization
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              A technical walkthrough of TerraQura&apos;s smart contract stack: ERC-1155 multi-token design, role-based
              access control, on-chain verification, and gasless marketplace settlement.
            </p>
            <div className="flex items-center gap-3 pb-8 border-b border-white/[0.06]">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-sm font-bold">TR</span>
              </div>
              <div>
                <div className="text-sm text-white font-medium">TerraQura Research</div>
                <div className="text-xs text-white/40 font-body">Carbon Verification &amp; Blockchain Infrastructure</div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Content */}
      <section className="relative pb-16 sm:pb-20 lg:pb-24">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <TableOfContents />

          <div className="prose-custom">
            <h2 id="architecture-overview" className="text-2xl font-bold text-white mt-12 mb-4">
              Architecture Overview
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura&apos;s smart contract architecture consists of five core contracts that together implement the complete
              lifecycle of a carbon credit, from verification to minting, trading, and retirement. The contracts are designed
              for upgradability (using the proxy pattern where appropriate), modularity (each contract handles a specific
              responsibility), and gas efficiency (minimizing on-chain storage and computation costs).
            </p>

            {/* Contract interaction diagram */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-4 uppercase tracking-wider">Core Contract Stack</div>
              <div className="space-y-3">
                {[
                  { name: "AccessControl", addr: "0x5569...B83b", desc: "Role-based permission management for all contracts", color: "border-purple-500/30 bg-purple-500/[0.05]" },
                  { name: "VerificationEngine", addr: "0x8dad...dEA8", desc: "On-chain verification logic, confidence scores, and proof storage", color: "border-cyan-500/30 bg-cyan-500/[0.05]" },
                  { name: "CarbonCredit (ERC-1155)", addr: "0x29B5...F959", desc: "Token minting, transfers, metadata, and retirement (burn)", color: "border-emerald-500/30 bg-emerald-500/[0.05]" },
                  { name: "CarbonMarketplace", addr: "0x5a4c...0A80", desc: "Order book, trade execution, and settlement", color: "border-amber-500/30 bg-amber-500/[0.05]" },
                  { name: "GaslessMarketplace", addr: "0x45a6...Fd80", desc: "Meta-transaction forwarder for gas-free user experience", color: "border-white/10 bg-white/[0.02]" },
                ].map((c) => (
                  <div key={c.name} className={`p-4 rounded-lg border ${c.color}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{c.name}</span>
                      <span className="text-xs text-white/30 font-mono">{c.addr}</span>
                    </div>
                    <span className="text-xs text-white/50 font-body">{c.desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/30 mt-4 font-body">
                Contract addresses shown are from the Aethelred testnet deployment.
              </p>
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-6">
              The contracts interact in a defined flow: AccessControl governs who can call which functions across all other
              contracts. The VerificationEngine receives verification proofs from the off-chain verification pipeline and
              stores them on-chain. When a verification passes, the VerificationEngine calls the CarbonCredit contract to
              mint new tokens. The CarbonMarketplace enables trading of minted tokens. The GaslessMarketplace wraps the
              CarbonMarketplace with meta-transaction support so that end users do not need to hold native tokens for gas.
            </p>

            <h2 id="erc-1155-design" className="text-2xl font-bold text-white mt-12 mb-4">
              ERC-1155 Design Rationale
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The choice of ERC-1155 over ERC-20 or ERC-721 was driven by the semi-fungible nature of carbon credits.
              Credits from the same project, vintage, methodology, and verification batch are fungible (interchangeable)
              with each other but not with credits from different combinations of these attributes. ERC-1155 natively
              supports this pattern through its multi-token-type design.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Each token ID in the CarbonCredit contract encodes a composite identifier. The token ID is a uint256 value
              where the upper 128 bits encode the project identifier, the middle 64 bits encode the vintage year and
              methodology version, and the lower 64 bits encode the verification batch number. This structured ID space
              allows efficient querying and filtering of credits by any combination of project, vintage, and batch.
            </p>

            {/* Token ID structure */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-3 uppercase tracking-wider">Token ID Structure (uint256)</div>
              <div className="font-mono text-sm overflow-x-auto">
                <div className="flex gap-0 mb-2">
                  <div className="flex-1 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-l-lg text-emerald-400 text-center text-xs">
                    Project ID (128 bits)
                  </div>
                  <div className="flex-1 p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-center text-xs">
                    Vintage + Method (64 bits)
                  </div>
                  <div className="flex-1 p-2 bg-amber-500/10 border border-amber-500/20 rounded-r-lg text-amber-400 text-center text-xs">
                    Batch Number (64 bits)
                  </div>
                </div>
                <div className="text-white/40 text-xs mt-2">
                  Example: 0x000000000000000000000001_000000002026_0001_00000000000000000042
                </div>
              </div>
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-4">
              Each token type has an associated metadata URI pointing to an IPFS document containing the full verification
              details: the sensor data hashes, verification confidence score, thermodynamic model parameters, and any
              additional attestation data. This metadata is immutable once set, ensuring that the verification record
              associated with a credit cannot be retroactively modified.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Retirement is implemented as a token burn. When a credit buyer wants to use credits to offset their
              emissions, they call the retire function, which burns the specified quantity of tokens and emits a
              Retirement event recording the retiring entity, the quantity retired, and the stated purpose. The burned
              tokens can never be re-minted or recovered, ensuring that retired credits cannot be re-used.
            </p>

            <h2 id="access-control" className="text-2xl font-bold text-white mt-12 mb-4">
              Access Control Patterns
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The AccessControl contract implements a role-based access control (RBAC) system inspired by OpenZeppelin&apos;s
              AccessControl but extended with carbon-market-specific roles. The role hierarchy defines who can perform
              which operations across the contract stack.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Key roles include ADMIN (can grant and revoke all other roles, manage contract upgrades), VERIFIER (can submit
              verification proofs to the VerificationEngine), MINTER (can trigger credit minting in the CarbonCredit
              contract, typically granted only to the VerificationEngine contract), OPERATOR (can manage facility registrations
              and sensor configurations), MARKETPLACE_ADMIN (can manage marketplace parameters such as fees and listing
              requirements), and PAUSER (can pause contract operations in emergency situations).
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Role assignments follow the principle of least privilege. For example, the VerificationEngine contract holds
              the MINTER role but cannot modify marketplace parameters. The marketplace admin can adjust fees but cannot
              mint new tokens. This separation of concerns limits the blast radius of any single compromised key.
            </p>

            <h2 id="verification-engine" className="text-2xl font-bold text-white mt-12 mb-4">
              Verification Engine Contract
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The VerificationEngine contract is the on-chain component of the Proof-of-Physics verification pipeline.
              It receives verification proofs from the off-chain verification system and stores them in contract state.
              Each proof contains a batch identifier, the computed CO2 quantity (in wei-denominated tonnes, using 18
              decimals for precision), the confidence score (0 to 10000 representing 0.00% to 100.00%), a Merkle root
              of the underlying sensor data, the timestamp range of the data, and the hash of the thermodynamic model
              used for validation.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              When a proof is submitted by an authorized VERIFIER address, the contract performs on-chain validation checks:
              it verifies that the confidence score meets the minimum threshold (currently 9500, representing 95.00%), that
              the batch ID has not been previously verified (preventing double-minting), that the CO2 quantity falls within
              plausible bounds for the facility type and time period, and that the timestamp range does not overlap with
              previously verified batches from the same facility.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              If all checks pass, the contract calls the CarbonCredit contract&apos;s mint function, creating new tokens
              representing the verified CO2 quantity. The verification proof is stored permanently in contract state and
              emitted as an event, creating a permanent on-chain record of the verification.
            </p>

            <h2 id="marketplace" className="text-2xl font-bold text-white mt-12 mb-4">
              Marketplace Mechanics
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The CarbonMarketplace contract implements an on-chain order book for carbon credit trading. Sellers list
              credits by specifying the token ID, quantity, and price per tonne (denominated in a stablecoin, currently
              USDC on the testnet). Buyers fill orders by specifying the listing ID and desired quantity. The marketplace
              handles atomic settlement: the buyer&apos;s stablecoin and the seller&apos;s carbon credits are exchanged in a single
              transaction, eliminating counterparty risk.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The marketplace charges a protocol fee on each transaction (currently 1% of the trade value), which is directed
              to a protocol treasury managed by the DAO. Sellers can cancel unfilled or partially filled listings at any
              time. The marketplace supports batch operations, allowing buyers to fill multiple listings in a single
              transaction to assemble a desired portfolio of credits.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              A key design decision was to implement the marketplace as a separate contract from the token contract. This
              allows the marketplace logic to be upgraded independently of the token contract, and it allows third-party
              marketplaces to be built on top of the same token contract without requiring permission from TerraQura.
            </p>

            <h2 id="gasless" className="text-2xl font-bold text-white mt-12 mb-4">
              Gasless Transactions (ERC-2771)
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Enterprise users purchasing carbon credits should not need to acquire and manage native cryptocurrency tokens
              to pay for gas. The GaslessMarketplace contract implements the ERC-2771 meta-transaction standard, allowing
              a trusted forwarder to submit transactions on behalf of users. Users sign their intended transaction
              off-chain, the forwarder bundles the signed message into a regular transaction, and the target contract
              extracts the original sender from the message rather than using msg.sender.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura operates a relayer service that monitors for signed meta-transactions, validates their signatures,
              and submits them to the network. The gas cost is borne by TerraQura and recovered through the protocol
              fee on marketplace transactions. This creates a seamless experience for enterprise buyers who interact
              only with the web interface and their wallet for signing, never needing to acquire or manage gas tokens.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The ERC-2771 approach was chosen over alternative gasless patterns (such as ERC-4337 account abstraction)
              because it requires minimal changes to the existing contract architecture and is well-supported by existing
              wallet infrastructure. As account abstraction matures, the architecture can migrate to ERC-4337 without
              changing the user experience.
            </p>

            <h2 id="contract-interactions" className="text-2xl font-bold text-white mt-12 mb-4">
              Contract Interaction Architecture
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The contracts form a directed dependency graph. The AccessControl contract sits at the base, referenced by
              all other contracts for permission checks. The VerificationEngine depends on AccessControl (for VERIFIER
              role checks) and calls CarbonCredit (for minting). The CarbonCredit contract depends on AccessControl
              (for MINTER role checks) and is called by both the VerificationEngine (for minting) and the Marketplace
              (for transfers during trade settlement). The CarbonMarketplace depends on AccessControl and interacts with
              CarbonCredit for token transfers and a stablecoin contract for payment settlement.
            </p>

            {/* Interaction flow */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-4 uppercase tracking-wider">Transaction Flow: Verification to Trade</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-cyan-400">1. Off-chain Verifier</span> --submitProof--&gt; <span className="text-emerald-400">VerificationEngine</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-emerald-400">2. VerificationEngine</span> --checkRole(VERIFIER)--&gt; <span className="text-purple-400">AccessControl</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-emerald-400">3. VerificationEngine</span> --mint(tokenId, qty)--&gt; <span className="text-emerald-400">CarbonCredit</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-emerald-400">4. CarbonCredit</span> --checkRole(MINTER)--&gt; <span className="text-purple-400">AccessControl</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-amber-400">5. Seller</span> --createListing(tokenId, qty, price)--&gt; <span className="text-amber-400">Marketplace</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-amber-400">6. Buyer</span> --fillOrder(listingId, qty)--&gt; <span className="text-amber-400">Marketplace</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-amber-400">7. Marketplace</span> --transferFrom(seller, buyer)--&gt; <span className="text-emerald-400">CarbonCredit</span>
                </div>
                <div className="p-2 bg-white/[0.02] rounded text-white/50">
                  <span className="text-amber-400">8. Marketplace</span> --transferFrom(buyer, seller)--&gt; <span className="text-white/40">USDC</span>
                </div>
              </div>
            </div>

            {/* Gas costs table */}
            <h2 id="gas-costs" className="text-2xl font-bold text-white mt-12 mb-4">
              Gas Cost Analysis
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Gas efficiency is a critical design consideration, particularly for high-frequency operations like
              verification proof submission and marketplace trading. The following table shows gas costs for key
              operations on the Aethelred testnet.
            </p>

            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Operation</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Gas Used</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Cost (Aethelred)</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Cost (Ethereum L1)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Submit verification proof", "~180,000", "~$0.005", "~$3.60"],
                    ["Mint credits (single type)", "~95,000", "~$0.003", "~$1.90"],
                    ["Mint credits (batch, 5 types)", "~220,000", "~$0.006", "~$4.40"],
                    ["Create marketplace listing", "~110,000", "~$0.003", "~$2.20"],
                    ["Fill order (single type)", "~145,000", "~$0.004", "~$2.90"],
                    ["Fill order (batch, 3 types)", "~210,000", "~$0.006", "~$4.20"],
                    ["Retire credits", "~85,000", "~$0.002", "~$1.70"],
                    ["Transfer credits", "~65,000", "~$0.002", "~$1.30"],
                  ].map(([op, gas, poly, eth], i) => (
                    <tr key={op} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{op}</td>
                      <td className="py-3 px-4 text-white/50 font-mono">{gas}</td>
                      <td className="py-3 px-4 text-emerald-400/80">{poly}</td>
                      <td className="py-3 px-4 text-white/40">{eth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-6">
              The gas savings from ERC-1155 batch operations are significant. A batch mint of 5 token types costs
              approximately 220,000 gas, compared to 5 individual mints at approximately 475,000 gas total (a 54%
              reduction). Similarly, batch fills in the marketplace provide substantial savings for buyers assembling
              multi-credit portfolios.
            </p>

            <h2 id="security" className="text-2xl font-bold text-white mt-12 mb-4">
              Security Considerations
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Smart contract security is paramount for a system handling potentially billions of dollars in carbon
              credit value. TerraQura&apos;s security approach includes multiple layers. All contracts are built on
              battle-tested OpenZeppelin libraries where possible, minimizing custom code that could contain
              vulnerabilities. Comprehensive unit and integration tests cover all contract functions, edge cases,
              and role-based access control scenarios. Static analysis tools (Slither, Mythril) are run as part of
              the CI/CD pipeline.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              External security audits are planned with top-tier firms (CertiK and/or Hacken) before mainnet
              deployment. The audit scope covers all five core contracts plus the meta-transaction infrastructure.
              A bug bounty program will be established post-audit to incentivize ongoing community security review.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Emergency response capabilities include a PAUSER role that can halt contract operations if a
              vulnerability is discovered. The pause affects marketplace trading and new minting but does not
              affect existing token balances or the ability to transfer tokens to cold storage. This design ensures
              that user assets remain accessible even during a security incident.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="5" label="Core smart contracts" />
              <MetricCard value="100%" label="Test coverage target" />
              <MetricCard value="ERC-2771" label="Gasless standard" />
              <MetricCard value="54%" label="Gas savings from batch operations" />
            </div>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura&apos;s smart contract architecture is purpose-built for the specific requirements of institutional
              carbon credit markets. The ERC-1155 multi-token standard provides the right abstraction for semi-fungible
              credits. Role-based access control ensures that critical operations are performed only by authorized
              parties. The on-chain verification engine creates an immutable record of every verification proof. The
              marketplace provides atomic settlement with price discovery. And gasless transactions remove the friction
              that would otherwise prevent enterprise adoption.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              With the smart contracts now deployed on the Aethelred sovereign chain, the architecture
              gains access to carbon-specific precompiled contracts for more efficient
              verification data access. The result is a complete, production-ready smart contract stack optimized
              for the institutional carbon credit lifecycle.
            </p>
          </div>

          {/* About blurb */}
          <div className="mt-16 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-2">About TerraQura</h3>
            <p className="text-sm text-white/60 font-body leading-relaxed">
              TerraQura is building institutional-grade carbon verification infrastructure powered by Proof-of-Physics on the
              Aethelred sovereign blockchain. Founded by Zhyra Holdings in Abu Dhabi, TerraQura provides real-time,
              physics-verified carbon credits for enterprise buyers, DAC operators, and institutional investors.
            </p>
          </div>

          <div className="mt-8">
            <Link href="/blog" className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-medium">
              &larr; Back to all articles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
