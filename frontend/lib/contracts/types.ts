/**
 * TypeScript types for the GenLayer JusticeUpgrade v2 Intelligent Contract.
 *
 * Mirrors the dataclass/return shapes in justice_upgrade.py (class JusticeUpgrade):
 *   - get_agreement(id)      -> full Agreement dict (terms, dispute, evidence,
 *                               tier/arbiters, ruling, votes, appeal history, …)
 *   - get_ruling(id)         -> compact { status, tier, arbiters, ruling,
 *                               reasoning, resolution, votes }
 *   - get_precedents(n)      -> Precedent[]  (anonymized public "case law")
 *   - precedent_stats()      -> { total, by_ruling }
 *   - get_config()           -> court configuration
 *   writes: create_agreement, file_dispute(…, evidence_json), resolve_dispute,
 *           appeal, accept_ruling
 */

/**
 * Lifecycle of an agreement on-chain.
 *   active   -> a recorded agreement, no dispute yet
 *   disputed -> a party filed a dispute (with evidence); awaiting a ruling
 *   ruled    -> the panel ruled; the losing party may appeal or accept
 *   final    -> the ruling is final (accepted, or the top tier reached) → precedent
 */
export type AgreementStatus = "active" | "disputed" | "ruled" | "final";

/** The bounded set of verdicts the on-chain arbiter is allowed to return. */
export type Ruling = "PARTY_A" | "PARTY_B" | "SPLIT" | "INSUFFICIENT_EVIDENCE";

/** The kind of a single evidence item attached to a dispute. */
export type EvidenceKind = "text" | "url";

/**
 * One evidence item. `kind`, `label`, `content` and `sha256` are set at filing
 * time. `fetched_excerpt` / `fetched_sha256` are filled in by the CONTRACT at
 * ruling time for `url` evidence — the chain itself opens the link live
 * (gl.nondet.web.render) and records what it saw. Empty until a ruling runs.
 */
export interface EvidenceItem {
  kind: EvidenceKind;
  label: string;
  content: string;
  /** sha256 commitment over kind+label+content, set at filing time. */
  sha256: string;
  /** Short snapshot of the page the contract fetched live (url evidence only). */
  fetched_excerpt: string;
  /** sha256 over the full fetched page text the panel judged (url evidence only). */
  fetched_sha256: string;
}

/** One panelist's bounded vote; always a member of {@link Ruling}. */
export type Vote = Ruling;

/** One rung of the appeal ladder — a past ruling at a given tier. */
export interface HistoryEntry {
  /** 1 (1 arbiter) -> 2 (3) -> 3 (5). */
  tier: number;
  /** Panel size that produced this ruling. */
  arbiters: number;
  ruling: Ruling;
  /** One bounded vote per panelist. */
  votes: Vote[];
  /** Timestamp string from the chain. */
  at: string;
}

/** Full agreement record as returned by get_agreement. */
export interface Agreement {
  id: string;
  party_a: string;
  party_b: string;
  terms: string;
  status: AgreementStatus;
  dispute: string;
  filed_by: string;
  evidence: EvidenceItem[];
  /** Current tier (0 until the first ruling). */
  tier: number;
  /** Panel size behind the current ruling. */
  arbiters: number;
  ruling: Ruling | "";
  reasoning: string;
  resolution: string;
  /** Panel votes behind the current ruling. */
  votes: Vote[];
  /** The appeal ladder: every ruling rendered so far, oldest first. */
  history: HistoryEntry[];
  created_at: string;
  updated_at: string;
}

/** Compact verdict view as returned by get_ruling. */
export interface RulingView {
  status: AgreementStatus;
  tier: number;
  arbiters: number;
  ruling: Ruling | "";
  reasoning: string;
  resolution: string;
  votes: Vote[];
}

/** The dict resolve_dispute / appeal effectively surface when a verdict lands. */
export interface Verdict {
  ruling: Ruling;
  reasoning: string;
  resolution: string;
  tier: number;
  arbiters: number;
  votes: Vote[];
}

/** One anonymized precedent as returned by get_precedents. */
export interface Precedent {
  ruling: Ruling;
  /** The final tier the dispute reached. */
  tiers: number;
  /** A one-line principle (no addresses, no verbatim terms). */
  principle: string;
  at: string;
}

/** Aggregate counts as returned by precedent_stats. */
export interface PrecedentStats {
  total: number;
  by_ruling: Record<Ruling, number>;
}

/** Court configuration as returned by get_config. */
export interface CourtConfig {
  schema: string;
  owner: string;
  relayer: string;
  paused: boolean;
  rulings: Ruling[];
  /** Panel size per tier, keyed by tier number as a string. */
  tier_arbiters: Record<string, number>;
  arbiter_names: string[];
  evidence_kinds: EvidenceKind[];
  max_evidence_items: number;
  precedents: number;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: unknown;
}

/**
 * A draft evidence item used by the dispute form before it is serialized to the
 * `evidence_json` string the contract expects (sha256/fetched fields are added
 * on-chain, never by the client).
 */
export interface EvidenceDraft {
  id: string;
  kind: EvidenceKind;
  label: string;
  content: string;
}
