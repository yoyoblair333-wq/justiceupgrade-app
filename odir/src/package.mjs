// The "justice evidence package": the off-chain record ODIR assembles for one JusticeUpgrade
// dispute. Every evidence item is committed with the SAME sha256 the contract computes in
// `_parse_evidence` — sha256(kind + "\n" + label + "\n" + content) over the sanitised values —
// and the whole bundle is bound by a package_sha256 over its canonical JSON. The commitments
// stored here are therefore byte-identical to the ones the on-chain court will hold, so the
// off-chain record is auditable against the chain.
//
// Mirrors C:\ODIR\repos\GenLayer-Integration-ODIR\adapter\src\package.js in style and the
// canonical-JSON / sha256 discipline.
import { canonical, digest, sha256 } from './canon.mjs';

export const PACKAGE_SCHEMA = 'justice-evidence-package/1';

// ---- Contract-mirrored constants (justice_upgrade.py) ---------------------------------------
export const EVIDENCE_KINDS = ['text', 'url'];
export const FILED_BY_ROLES = ['PARTY_A', 'PARTY_B'];
export const MAX_EVIDENCE_ITEMS = 6;
export const MAX_LABEL_CHARS = 80;
export const MAX_TEXT_EVIDENCE_CHARS = 2000;
export const MAX_URL_CHARS = 400;
export const MAX_DISPUTE_CHARS = 4000;
export const MAX_ID_CHARS = 128;

// _URL_RE in the contract. A single https:// URL, no whitespace.
const URL_RE = /^https:\/\/[A-Za-z0-9.\-]+(?::\d+)?(?:\/[^\s]*)?$/;

// _INVISIBLE_RE in the contract (zero-width / bidi / BOM code points).
const INVISIBLE_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/gu;

// _CONTROL_PATTERNS in the contract: an injection screen that rejects text trying to command
// the arbiter rather than describe a dispute. Ported verbatim so this adapter rejects exactly
// what `file_dispute` would reject (`i` = IGNORECASE; the contract has no MULTILINE).
const CONTROL_PATTERNS = [
  String.raw`ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)`,
  String.raw`disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|instructions|rules)`,
  String.raw`(system|developer)\s*(prompt|message|instruction)`,
  String.raw`you\s+are\s+now\b`,
  String.raw`new\s+instructions?`,
  String.raw`\bjailbreak\b`,
  String.raw`rule\s+(for|in\s+favor\s+of)\s+(me|party)`,
  String.raw`always\s+(rule|decide|find)\b`,
  String.raw`<<<|>>>`,
  '```',
];
const CONTROL_RE = new RegExp(CONTROL_PATTERNS.map((p) => `(?:${p})`).join('|'), 'i');

export class PackageError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [problems];
    super(`invalid justice evidence package: ${list.join('; ')}`);
    this.problems = list;
  }
}

// --------------------------------------------------------------------------------------------
// Pure helpers, mirroring the contract's pure helpers.
// --------------------------------------------------------------------------------------------

// Contract `_sanitise`: NFKC-normalize, strip invisible code points, drop control chars
// (Unicode general category "C*") except newline and tab, then trim. Idempotent, so a value
// sanitised here hashes to the same thing the contract computes after it re-sanitises.
export function sanitise(raw, label) {
  if (typeof raw !== 'string') throw new PackageError(`${label} must be text`);
  let text = raw.normalize('NFKC');
  text = text.replace(INVISIBLE_RE, '');
  text = Array.from(text).filter((ch) => !/\p{C}/u.test(ch) || ch === '\n' || ch === '\t').join('');
  return text.trim();
}

// Contract `_check_clean`: reject arbiter-directed instructions before anything is committed.
function checkClean(text, label) {
  if (CONTROL_RE.test(text)) {
    throw new PackageError(`${label} contains instructions aimed at the arbiter, not a description of the dispute`);
  }
}

// Length by Unicode code point (Python's len()), not by UTF-16 code unit.
const clen = (s) => Array.from(s).length;

// The contract's per-item commitment, exactly: a sha256 over the CANONICAL JSON of the whole
// {kind,label,content} object — digest({kind,label,content}) — i.e.
//   hashlib.sha256(json.dumps({"kind":k,"label":l,"content":c},
//                             sort_keys=True, separators=(",",":"), ensure_ascii=True).encode("utf-8")).hexdigest()
// Canonical sorting puts the keys in content,kind,label order. This replaced the earlier
// "kind\nlabel\ncontent" string, which an embedded newline could make ambiguous.
export const itemSha256 = (kind, label, content) => digest({ kind, label, content });

// --------------------------------------------------------------------------------------------
// Evidence validation — mirrors `_parse_evidence`, returning committed items.
// --------------------------------------------------------------------------------------------
export function parseEvidence(raw) {
  let items = raw;
  if (raw === null || raw === undefined || raw === '') return [];
  if (typeof raw === 'string') {
    try { items = JSON.parse(raw); } catch { throw new PackageError('evidence must be a JSON array'); }
  }
  if (!Array.isArray(items)) throw new PackageError('evidence must be a JSON array');
  if (items.length > MAX_EVIDENCE_ITEMS) throw new PackageError(`at most ${MAX_EVIDENCE_ITEMS} evidence items`);

  return items.map((it, i) => {
    if (it === null || typeof it !== 'object' || Array.isArray(it)) throw new PackageError(`evidence[${i}] must be an object`);
    const kind = it.kind;
    if (!EVIDENCE_KINDS.includes(kind)) throw new PackageError(`evidence[${i}].kind must be 'text' or 'url'`);

    const label = sanitise(it.label ?? '', `evidence[${i}].label`);
    if (clen(label) > MAX_LABEL_CHARS) throw new PackageError(`evidence[${i}].label exceeds ${MAX_LABEL_CHARS} characters`);
    checkClean(label, `evidence[${i}].label`);

    const content = sanitise(it.content ?? '', `evidence[${i}].content`);
    if (!content) throw new PackageError(`evidence[${i}].content cannot be empty`);
    if (kind === 'text') {
      if (clen(content) > MAX_TEXT_EVIDENCE_CHARS) throw new PackageError(`evidence[${i}].content exceeds ${MAX_TEXT_EVIDENCE_CHARS} characters`);
      checkClean(content, `evidence[${i}].content`);
    } else {
      if (clen(content) > MAX_URL_CHARS || !URL_RE.test(content)) throw new PackageError(`evidence[${i}].content must be a single https:// URL`);
    }
    return { kind, label, content, sha256: itemSha256(kind, label, content) };
  });
}

// --------------------------------------------------------------------------------------------
// Build the package.
// --------------------------------------------------------------------------------------------

// A deterministic key over only the committed content — the same dispute+evidence always
// yields the same key, regardless of when or by whom it was assembled. A relayer can use it to
// de-duplicate file_dispute calls.
function idempotencyKey(agreementId, filedByRole, dispute, items) {
  return digest({
    v: 1,
    agreement_id: agreementId,
    filed_by_role: filedByRole,
    dispute_sha256: sha256(dispute),
    evidence_commitments: items.map((it) => it.sha256),
  });
}

/**
 * Build a justice evidence package from a dispute.
 * @param {{agreement_id:string, filed_by_role:string, dispute:string, evidence:Array}} input
 * @param {{assembled_by?:string, assembled_at?:string, tool?:string, release_approval?:string, disclosure_note?:string}} [opts]
 */
export function buildPackage(input, opts = {}) {
  if (!input || typeof input !== 'object') throw new PackageError('input must be an object');

  const agreementId = input.agreement_id;
  if (typeof agreementId !== 'string' || clen(agreementId) === 0 || clen(agreementId) > MAX_ID_CHARS) {
    throw new PackageError(`agreement_id must be 1..${MAX_ID_CHARS} characters`);
  }

  const filedByRole = input.filed_by_role;
  if (!FILED_BY_ROLES.includes(filedByRole)) throw new PackageError("filed_by_role must be 'PARTY_A' or 'PARTY_B'");

  const dispute = sanitise(input.dispute ?? '', 'dispute');
  if (!dispute) throw new PackageError('dispute cannot be empty');
  if (clen(dispute) > MAX_DISPUTE_CHARS) throw new PackageError(`dispute exceeds ${MAX_DISPUTE_CHARS} characters`);
  checkClean(dispute, 'dispute');

  const items = parseEvidence(input.evidence);

  // The exact JSON string a relayer passes to file_dispute(agreement_id, statement, evidence_json).
  // The contract re-sanitises these values; sanitise is idempotent, so the commitments it
  // recomputes equal the ones below.
  const relayEvidenceJson = JSON.stringify(items.map(({ kind, label, content }) => ({ kind, label, content })));

  // Everything except package_sha256 — a package cannot contain a hash of itself.
  const core = {
    schema: PACKAGE_SCHEMA,
    agreement_id: agreementId,
    filed_by_role: filedByRole,
    dispute,
    evidence: items,
    commitment: {
      algorithm: 'sha256',
      per_item_formula: 'sha256(utf8(kind + "\\n" + label + "\\n" + content))',
      canonical_json: "json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=True)",
    },
    provenance: {
      assembled_by: typeof opts.assembled_by === 'string' ? opts.assembled_by : 'ODIR',
      assembled_at: typeof opts.assembled_at === 'string' ? opts.assembled_at : new Date().toISOString(),
      tool: typeof opts.tool === 'string' ? opts.tool : 'justice-odir/1',
    },
    disclosure: {
      note: typeof opts.disclosure_note === 'string' ? opts.disclosure_note
        : 'Evidence is committed off-chain by ODIR and relayed to the on-chain court; URL evidence is re-fetched and re-judged by every validator at resolution time.',
      release_approval: typeof opts.release_approval === 'string' ? opts.release_approval : 'assembler (default)',
    },
    idempotency: { request_key: idempotencyKey(agreementId, filedByRole, dispute, items) },
    relay: {
      method: 'file_dispute',
      args: ['agreement_id', 'statement', 'evidence_json'],
      evidence_json: relayEvidenceJson,
    },
  };

  const packageSha256 = digest(core);
  return { ...core, package_sha256: packageSha256 };
}

// Identity of a package: canonical digest of every field except package_sha256.
export function packageSha256(bundle) {
  const { package_sha256, ...core } = bundle;
  return digest(core);
}

// --------------------------------------------------------------------------------------------
// Verify: recompute and check every hash in an existing bundle.
// --------------------------------------------------------------------------------------------
export function verifyPackage(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new PackageError('bundle must be an object');
  const problems = [];

  const items = Array.isArray(bundle.evidence) ? bundle.evidence : [];
  const itemResults = items.map((it, i) => {
    const expected = itemSha256(it.kind, it.label, it.content);
    const match = expected === it.sha256;
    if (!match) problems.push(`evidence[${i}].sha256 mismatch (stored ${it.sha256}, recomputed ${expected})`);
    // Prove the committed value is already in canonical sanitised form (so the contract's
    // re-sanitisation would not change the commitment).
    let reSan = null;
    try { reSan = sanitise(it.label, 'l') === it.label && sanitise(it.content, 'c') === it.content; } catch { reSan = false; }
    if (reSan === false) problems.push(`evidence[${i}] is not in canonical sanitised form`);
    return { index: i, label: it.label, kind: it.kind, stored: it.sha256, recomputed: expected, match };
  });

  const expectedPkg = packageSha256(bundle);
  const pkgMatch = expectedPkg === bundle.package_sha256;
  if (!pkgMatch) problems.push(`package_sha256 mismatch (stored ${bundle.package_sha256}, recomputed ${expectedPkg})`);

  let idemMatch = null;
  if (bundle.idempotency && typeof bundle.idempotency.request_key === 'string') {
    const expectedKey = idempotencyKey(bundle.agreement_id, bundle.filed_by_role, bundle.dispute, items);
    idemMatch = expectedKey === bundle.idempotency.request_key;
    if (!idemMatch) problems.push(`idempotency.request_key mismatch (stored ${bundle.idempotency.request_key}, recomputed ${expectedKey})`);
  }

  return {
    ok: problems.length === 0,
    package_sha256: { stored: bundle.package_sha256, recomputed: expectedPkg, match: pkgMatch },
    idempotency: idemMatch === null ? null : { match: idemMatch },
    items: itemResults,
    canonical_bytes: Buffer.byteLength(canonical((({ package_sha256, ...c }) => c)(bundle)), 'utf8'),
    problems,
  };
}
