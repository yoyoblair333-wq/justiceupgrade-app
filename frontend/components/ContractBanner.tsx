"use client";

import { AlertTriangle } from "lucide-react";
import { useIsContractConfigured } from "@/lib/hooks/useJusticeUpgrade";

/**
 * Graceful-degradation banner. The JusticeUpgrade v2 contract is not yet
 * deployed, so when no address is configured the app stays fully up (you can
 * see the whole UI) but makes the "set the address" state unmistakable rather
 * than inventing an address or failing silently.
 */
export function ContractBanner() {
  const isConfigured = useIsContractConfigured();
  if (isConfigured) return null;

  return (
    <div
      role="status"
      className="mb-8 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-yellow-300">
            Contract not deployed yet — read-only preview
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            The JusticeUpgrade v2 contract isn&apos;t live on GenLayer yet, so on-chain
            reads and writes are disabled. Once it&apos;s deployed, set{" "}
            <code className="font-mono text-xs bg-black/30 rounded px-1.5 py-0.5 text-yellow-200">
              NEXT_PUBLIC_JUSTICE_CONTRACT_ADDRESS
            </code>{" "}
            in your <span className="font-mono text-xs">.env</span> to the deployed
            address and reload. Everything below shows exactly how the court will work.
          </p>
        </div>
      </div>
    </div>
  );
}
