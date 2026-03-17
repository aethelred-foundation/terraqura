"use client";

// TerraQura Risk Disclaimer
// ADGM FSRA compliance disclaimer component

import { useState } from "react";

interface RiskDisclaimerProps {
  variant?: "banner" | "footer" | "modal";
  onDismiss?: () => void;
}

export function RiskDisclaimer({
  variant = "footer",
  onDismiss,
}: RiskDisclaimerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed && variant === "banner") {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (variant === "banner") {
    return (
      <div className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-amber-200/80">
            <WarningIcon className="h-4 w-4 flex-shrink-0" />
            <p>
              <strong>Risk Warning:</strong> Carbon Credit Tokens are volatile
              environmental assets. Past performance does not guarantee future
              results. Only trade with funds you can afford to lose.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-amber-200/60 hover:text-amber-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === "modal") {
    return (
      <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <WarningIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div>
            <h4 className="font-medium text-amber-200">Important Risk Disclosure</h4>
            <ul className="mt-2 space-y-1 text-sm text-amber-200/70">
              <li>• Carbon Credit Tokens (CCTs) are volatile environmental assets</li>
              <li>• CCTs are NOT investment securities or financial instruments</li>
              <li>• Market prices can fluctuate significantly</li>
              <li>• Past performance does not indicate future results</li>
              <li>• Only trade with capital you can afford to lose</li>
              <li>• Consult a financial advisor before making decisions</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Footer variant (default)
  return (
    <footer className="border-t border-gray-800 bg-gray-950 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 rounded-lg border border-amber-900/30 bg-amber-950/10 p-4">
          <div className="flex items-start gap-3">
            <WarningIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="text-xs text-amber-200/80">
              <p className="font-medium">Risk Disclosure</p>
              <p className="mt-1">
                Carbon Credit Tokens ("CCTs") are volatile environmental assets
                and are NOT investment securities, financial instruments, or
                regulated products. The value of CCTs may fluctuate significantly
                and you may lose some or all of your investment. Past performance
                is not indicative of future results. Trading in CCTs involves
                substantial risk and is not suitable for all investors. You should
                not invest more than you can afford to lose. Please consult a
                qualified financial advisor before making any trading decisions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex flex-wrap gap-4">
            <a href="/legal/terms" className="hover:text-gray-300">
              Terms of Service
            </a>
            <a href="/legal/privacy" className="hover:text-gray-300">
              Privacy Policy
            </a>
            <a href="/legal/cookies" className="hover:text-gray-300">
              Cookie Policy
            </a>
            <a href="/legal/aml" className="hover:text-gray-300">
              AML Policy
            </a>
          </div>

          <div className="flex items-center gap-2">
            <span>Regulated by ADGM FSRA</span>
            <span className="text-gray-700">|</span>
            <span>&copy; {new Date().getFullYear()} TerraQura Limited</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Transaction Risk Modal
export function TransactionRiskModal({
  isOpen,
  onConfirm,
  onCancel,
  action,
  amount,
  tokenId,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  action: "buy" | "sell" | "retire";
  amount: string;
  tokenId: string;
}) {
  if (!isOpen) return null;

  const actionText = {
    buy: "Purchase",
    sell: "List for Sale",
    retire: "Retire",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 shadow-2xl">
        <div className="border-b border-gray-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Confirm {actionText[action]}</h3>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-lg bg-gray-800 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Action</span>
              <span className="font-medium text-white">{actionText[action]}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-400">Amount</span>
              <span className="font-medium text-white">{amount} tonnes CO2</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-400">Token ID</span>
              <span className="font-mono text-white">{tokenId}</span>
            </div>
          </div>

          <RiskDisclaimer variant="modal" />

          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                id="risk-acknowledged"
                className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-500"
              />
              <span className="text-sm text-gray-300">
                I understand and accept the risks associated with this transaction
              </span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-700 px-6 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-600 px-4 py-2.5 font-medium text-gray-300 transition-colors hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Confirm {actionText[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default RiskDisclaimer;
