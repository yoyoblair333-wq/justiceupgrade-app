"use client";

import { useState } from "react";
import { Check, Copy, FileText, Globe, ShieldCheck, Clock } from "lucide-react";
import type { EvidenceItem } from "@/lib/contracts/types";

/**
 * Displays a dispute's committed evidence. URL evidence is the flagship: once
 * the panel has ruled, each URL item carries what the CONTRACT ITSELF fetched
 * live (fetched_excerpt + fetched_sha256), which we surface prominently.
 */
export function EvidenceList({
  evidence,
  ruled,
}: {
  evidence: EvidenceItem[];
  ruled: boolean;
}) {
  if (!evidence || evidence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No evidence was submitted with this dispute.
      </p>
    );
  }

  const urlCount = evidence.filter((e) => e.kind === "url").length;

  return (
    <div className="space-y-4">
      {urlCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/10 p-3">
          <Globe className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-foreground/90">
            <span className="font-semibold text-accent">Live web evidence.</span>{" "}
            {urlCount === 1 ? "One link was" : `${urlCount} links were`} submitted as
            URL evidence. The chain itself opens {urlCount === 1 ? "it" : "them"} during
            the ruling — and every validator independently re-fetches and re-judges.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {evidence.map((item, idx) => (
          <li key={idx}>
            {item.kind === "url" ? (
              <UrlEvidence item={item} ruled={ruled} index={idx} />
            ) : (
              <TextEvidence item={item} index={idx} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextEvidence({ item, index }: { item: EvidenceItem; index: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{item.label || `Evidence ${index + 1}`}</span>
        <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">
          Text
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
        {item.content}
      </p>
      <Commitment sha256={item.sha256} />
    </div>
  );
}

function UrlEvidence({
  item,
  ruled,
  index,
}: {
  item: EvidenceItem;
  ruled: boolean;
  index: number;
}) {
  const fetched = !!item.fetched_sha256;
  return (
    <div className="rounded-md border border-accent/30 bg-gradient-to-b from-accent/[0.08] to-transparent overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border-b border-accent/20">
        <Globe className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm font-medium">{item.label || `Evidence ${index + 1}`}</span>
        <span className="ml-auto text-xs uppercase tracking-wider text-accent">
          Live URL
        </span>
      </div>

      <div className="p-3 space-y-3">
        <a
          href={item.content}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="block font-mono text-xs text-accent hover:underline break-all"
        >
          {item.content}
        </a>

        {fetched ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              The chain opened this link and judged what it saw
            </p>
            <blockquote className="rounded-md bg-black/30 border border-white/10 p-3 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {item.fetched_excerpt || "(the page returned no readable text)"}
            </blockquote>
            <Commitment label="fetched page sha256" sha256={item.fetched_sha256} highlight />
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {ruled
              ? "This link was not reachable when the panel ran."
              : "The chain will open this link live when the panel rules."}
          </p>
        )}

        <Commitment sha256={item.sha256} />
      </div>
    </div>
  );
}

/** A small, click-to-copy sha256 commitment chip (tamper-evident evidence). */
function Commitment({
  sha256,
  label = "commitment",
  highlight = false,
}: {
  sha256: string;
  label?: string;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!sha256) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`${label}: ${sha256} (click to copy)`}
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-mono transition-colors ${
        highlight
          ? "bg-accent/15 text-accent hover:bg-accent/25"
          : "bg-white/5 text-muted-foreground hover:bg-white/10"
      }`}
    >
      <span className="uppercase tracking-wider not-italic font-sans text-[10px]">{label}</span>
      <span>{sha256.slice(0, 10)}…{sha256.slice(-6)}</span>
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}
