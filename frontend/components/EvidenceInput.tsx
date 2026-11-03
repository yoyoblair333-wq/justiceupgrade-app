"use client";

import { FileText, Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { EvidenceDraft, EvidenceKind } from "@/lib/contracts/types";

/**
 * Contract-side evidence limits (justice_upgrade.py). Mirrored here so the form
 * validates before spending a transaction; the contract re-validates on-chain.
 */
export const EVIDENCE_LIMITS = {
  MAX_ITEMS: 6,
  MAX_LABEL_CHARS: 80,
  MAX_TEXT_CHARS: 2000,
  MAX_URL_CHARS: 400,
};

const HTTPS_URL_RE = /^https:\/\/[A-Za-z0-9.\-]+(?::\d+)?(?:\/[^\s]*)?$/;

let draftSeq = 0;
function newDraft(kind: EvidenceKind = "text"): EvidenceDraft {
  draftSeq += 1;
  return { id: `ev-${Date.now()}-${draftSeq}`, kind, label: "", content: "" };
}

export function createEvidenceDraft(kind?: EvidenceKind): EvidenceDraft {
  return newDraft(kind);
}

/** First client-side validation message for an item, or "" if it is valid. */
export function validateEvidenceItem(item: EvidenceDraft): string {
  const label = item.label.trim();
  const content = item.content.trim();
  if (!content) return "Evidence content cannot be empty.";
  if (label.length > EVIDENCE_LIMITS.MAX_LABEL_CHARS)
    return `Label exceeds ${EVIDENCE_LIMITS.MAX_LABEL_CHARS} characters.`;
  if (item.kind === "text") {
    if (content.length > EVIDENCE_LIMITS.MAX_TEXT_CHARS)
      return `Text evidence exceeds ${EVIDENCE_LIMITS.MAX_TEXT_CHARS} characters.`;
  } else {
    if (content.length > EVIDENCE_LIMITS.MAX_URL_CHARS || !HTTPS_URL_RE.test(content))
      return "URL evidence must be a single https:// link.";
  }
  return "";
}

/**
 * Serialize the drafts into the `evidence_json` string the contract expects:
 * a JSON array of { kind, label, content }. Returns "" when there is no
 * evidence (the contract treats "" as an empty list).
 */
export function serializeEvidence(items: EvidenceDraft[]): string {
  const cleaned = items
    .map((it) => ({
      kind: it.kind,
      label: it.label.trim(),
      content: it.content.trim(),
    }))
    .filter((it) => it.content.length > 0);
  if (cleaned.length === 0) return "";
  return JSON.stringify(cleaned);
}

interface EvidenceInputProps {
  items: EvidenceDraft[];
  onChange: (items: EvidenceDraft[]) => void;
  disabled?: boolean;
}

/**
 * Editor for a dispute's evidence list. Each item is either free text or a
 * single https URL, with a short label. URL evidence is the flagship: the
 * contract itself opens the link live at ruling time and grounds the verdict in
 * what it sees — so a URL here becomes live, consensus-checked web evidence.
 */
export function EvidenceInput({ items, onChange, disabled }: EvidenceInputProps) {
  const atMax = items.length >= EVIDENCE_LIMITS.MAX_ITEMS;

  const update = (id: string, patch: Partial<EvidenceDraft>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));

  const add = () => {
    if (atMax) return;
    onChange([...items, newDraft("text")]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">Evidence</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Optional. Add up to {EVIDENCE_LIMITS.MAX_ITEMS} items — text, or an{" "}
            <span className="text-accent">https URL the chain fetches live</span>.
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {items.length}/{EVIDENCE_LIMITS.MAX_ITEMS}
        </span>
      </div>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item, idx) => {
            const msg = validateEvidenceItem(item);
            const showError = (item.content.trim().length > 0 || item.label.trim().length > 0) && !!msg;
            const labelId = `ev-label-${item.id}`;
            const contentId = `ev-content-${item.id}`;
            return (
              <li
                key={item.id}
                className="rounded-md border border-white/10 bg-black/20 p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Item {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      role="radiogroup"
                      aria-label={`Evidence item ${idx + 1} kind`}
                      className="inline-flex rounded-md border border-white/10 overflow-hidden"
                    >
                      <KindToggle
                        active={item.kind === "text"}
                        onClick={() => update(item.id, { kind: "text" })}
                        disabled={disabled}
                        icon={<FileText className="w-3.5 h-3.5" />}
                        label="Text"
                      />
                      <KindToggle
                        active={item.kind === "url"}
                        onClick={() => update(item.id, { kind: "url" })}
                        disabled={disabled}
                        icon={<Globe className="w-3.5 h-3.5" />}
                        label="URL"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(item.id)}
                      disabled={disabled}
                      aria-label={`Remove evidence item ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={labelId} className="text-xs text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    id={labelId}
                    placeholder={item.kind === "url" ? "e.g. Delivery confirmation page" : "e.g. Email from Party B"}
                    value={item.label}
                    maxLength={EVIDENCE_LIMITS.MAX_LABEL_CHARS}
                    disabled={disabled}
                    onChange={(e) => update(item.id, { label: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={contentId} className="text-xs text-muted-foreground">
                    {item.kind === "url" ? "https URL" : "Text"}
                  </Label>
                  {item.kind === "url" ? (
                    <Input
                      id={contentId}
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      value={item.content}
                      maxLength={EVIDENCE_LIMITS.MAX_URL_CHARS}
                      disabled={disabled}
                      aria-invalid={showError}
                      className={`font-mono ${showError ? "border-destructive" : ""}`}
                      onChange={(e) => update(item.id, { content: e.target.value })}
                    />
                  ) : (
                    <textarea
                      id={contentId}
                      rows={3}
                      placeholder="Paste the relevant text (a clause, a message, a receipt line)…"
                      value={item.content}
                      maxLength={EVIDENCE_LIMITS.MAX_TEXT_CHARS}
                      disabled={disabled}
                      aria-invalid={showError}
                      className={`placeholder:text-muted-foreground border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 ${
                        showError ? "border-destructive" : ""
                      }`}
                    />
                  )}
                  {item.kind === "url" ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3 h-3 text-accent shrink-0" />
                      The contract opens this link itself during the ruling.
                    </p>
                  ) : null}
                  {showError && <p className="text-xs text-destructive">{msg}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled || atMax}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        {atMax ? `Maximum ${EVIDENCE_LIMITS.MAX_ITEMS} items` : "Add evidence"}
      </Button>
    </div>
  );
}

function KindToggle({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        active
          ? "bg-accent/20 text-accent"
          : "text-muted-foreground hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
