"use client";

// TerraQura Terms of Service Modal
// Click-wrap agreement for ADGM compliance

import { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";

interface TermsModalProps {
  isOpen: boolean;
  onAccept: (signature: string) => void;
  onDecline: () => void;
}

const TERMS_VERSION = "1.0.0";
const TERMS_HASH = "0x..."; // Hash of terms document

export function TermsModal({ isOpen, onAccept, onDecline }: TermsModalProps) {
  const { address } = useAccount();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const { signMessageAsync } = useSignMessage();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom =
      Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!address) return;

    setIsSigning(true);

    try {
      // Create message to sign
      const message = `I, the owner of wallet ${address}, agree to the TerraQura Terms of Service (Version ${TERMS_VERSION}).\n\nTimestamp: ${new Date().toISOString()}\nTerms Hash: ${TERMS_HASH}`;

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Store acceptance (would be sent to backend)
      localStorage.setItem(
        `terraqura_terms_accepted_${address}`,
        JSON.stringify({
          version: TERMS_VERSION,
          signature,
          timestamp: new Date().toISOString(),
        })
      );

      onAccept(signature);
    } catch (error) {
      console.error("Failed to sign terms:", error);
    } finally {
      setIsSigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            TerraQura Terms of Service
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Please read and accept our terms to continue
          </p>
        </div>

        {/* Terms Content */}
        <div
          className="h-96 overflow-y-auto p-6 text-sm text-gray-300"
          onScroll={handleScroll}
        >
          <div className="space-y-4">
            <h3 className="font-bold text-white">1. INTRODUCTION</h3>
            <p>
              These Terms of Service ("Terms") govern your access to and use of
              the TerraQura platform ("Platform"), operated by TerraQura Limited,
              a company registered in the Abu Dhabi Global Market ("ADGM").
            </p>

            <h3 className="font-bold text-white">2. ELIGIBILITY</h3>
            <p>
              To use the Platform, you must: (a) be at least 18 years of age;
              (b) have the legal capacity to enter into binding contracts;
              (c) not be located in any jurisdiction where use of the Platform
              is prohibited; (d) successfully complete our Know Your Customer
              ("KYC") verification process.
            </p>

            <h3 className="font-bold text-white">3. CARBON CREDIT TOKENS</h3>
            <p>
              Carbon Credit Tokens ("CCTs") represent verified carbon dioxide
              removal or reduction. Each CCT corresponds to one metric tonne of
              CO2 equivalent that has been verified through our Proof-of-Physics
              verification system. CCTs are ERC-1155 tokens on the TerraQura
              blockchain infrastructure.
            </p>

            <h3 className="font-bold text-white">4. VERIFICATION PROCESS</h3>
            <p>
              All carbon credits undergo a three-phase verification process:
              (a) Source Check - validates data authenticity from IoT sensors;
              (b) Logic Check - ensures efficiency metrics fall within acceptable
              parameters (200-600 kWh per tonne of CO2); (c) Mint Check - final
              validation before token minting. We use our sovereign NativeIoT Oracle for
              1st-party verification with satellite imagery cross-referencing.
            </p>

            <h3 className="font-bold text-white">5. MARKETPLACE</h3>
            <p>
              The Platform provides a peer-to-peer marketplace for trading CCTs.
              All transactions are executed through smart contracts on the TerraQura
              blockchain infrastructure. A platform fee of 2.5% applies to all marketplace
              transactions. Prices are denominated in USDC.
            </p>

            <h3 className="font-bold text-white">6. KYC/AML COMPLIANCE</h3>
            <p>
              In compliance with ADGM regulations and international anti-money
              laundering standards, all users must complete identity verification
              before participating in the marketplace. We conduct ongoing
              sanctions screening and reserve the right to suspend accounts that
              fail compliance checks.
            </p>

            <h3 className="font-bold text-white">7. DATA PRIVACY</h3>
            <p>
              Personal data is processed in accordance with ADGM Data Protection
              Regulations and GDPR where applicable. Sensitive data is stored
              off-chain with cryptographic hashes recorded on-chain for
              verification purposes. You have the right to request data deletion
              (Right to Erasure).
            </p>

            <h3 className="font-bold text-white">8. INTELLECTUAL PROPERTY</h3>
            <p>
              All intellectual property rights in the Platform, including smart
              contracts, verification algorithms, and user interface, are owned
              by TerraQura Limited. Users retain ownership of their CCTs.
            </p>

            <h3 className="font-bold text-white">9. LIMITATION OF LIABILITY</h3>
            <p>
              To the maximum extent permitted by law, TerraQura shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages arising from your use of the Platform. Our total
              liability shall not exceed the fees paid by you in the 12 months
              preceding the claim.
            </p>

            <h3 className="font-bold text-white">10. GOVERNING LAW</h3>
            <p>
              These Terms are governed by the laws of the Abu Dhabi Global Market.
              Any disputes shall be resolved through arbitration in accordance
              with the ADGM Arbitration Regulations.
            </p>

            <h3 className="font-bold text-white">11. AMENDMENTS</h3>
            <p>
              We may update these Terms from time to time. Material changes will
              be communicated via email and Platform notification. Continued use
              after changes constitutes acceptance of the updated Terms.
            </p>

            <h3 className="font-bold text-white">12. CONTACT</h3>
            <p>
              For questions about these Terms, please contact:
              legal@terraqura.com
            </p>

            <p className="mt-6 text-xs text-gray-500">
              Version {TERMS_VERSION} | Last Updated: February 2026
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        {!hasScrolledToBottom && (
          <div className="border-t border-gray-700 bg-amber-900/20 px-6 py-2 text-center text-sm text-amber-300">
            Please scroll to read the complete terms
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-700 bg-gray-800 px-6 py-4">
          {/* Checkbox */}
          <label className="mb-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span
              className={`text-sm ${hasScrolledToBottom ? "text-gray-300" : "text-gray-500"}`}
            >
              I have read, understood, and agree to be bound by the TerraQura
              Terms of Service and acknowledge that Carbon Credit Tokens are
              environmental assets, not investment securities.
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onDecline}
              className="flex-1 rounded-lg border border-gray-600 px-4 py-2.5 font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={!isChecked || !hasScrolledToBottom || isSigning}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigning ? "Signing..." : "Accept & Sign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check if user has accepted terms
export function useTermsAccepted() {
  const { address } = useAccount();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setAccepted(false);
      setLoading(false);
      return;
    }

    const stored = localStorage.getItem(`terraqura_terms_accepted_${address}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Check if the version matches
        if (data.version === TERMS_VERSION) {
          setAccepted(true);
        }
      } catch {
        // Invalid data
      }
    }

    setLoading(false);
  }, [address]);

  return { accepted, loading };
}

export default TermsModal;
