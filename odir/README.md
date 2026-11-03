# JusticeUpgrade v2 — ODIR evidence adapter

Off-chain adapter that packages a dispute's evidence for the **JusticeUpgrade v2** on-chain AI
arbitration court (`../contracts/justice_upgrade.py`) into a **canonical, sha256-committed
bundle**. The commitments it writes are **byte-identical** to the ones the contract computes, so
the off-chain record is auditable against the chain and the on-chain commitments match an
auditable off-chain record — the milestone's ODIR story (contract docstring §6).

It mirrors the style and the canonical-JSON discipline of the ODIR review-package adapter
(`C:\ODIR\repos\GenLayer-Integration-ODIR\adapter`). It is **read-only**: it never signs,
never submits, and holds no keys.

## How it maps to the contract's evidence commitments

A dispute carries a list of evidence items, each `{kind, label, content}` with
`kind ∈ {"text","url"}`. In `file_dispute`, the contract's `_parse_evidence` validates and
sanitises each item and commits it with a sha256 over the **canonical JSON of the whole item
object** (not `kind\nlabel\ncontent`, which an embedded newline could make ambiguous):

```python
"sha256": _digest(json.dumps(
    {"kind": kind, "label": label, "content": content},
    sort_keys=True, separators=(",", ":"), ensure_ascii=True))     # _digest = hashlib.sha256(... utf-8 ...).hexdigest()
```

Canonical sorting orders the keys `content, kind, label`. This adapter computes the **same**
value in `src/package.mjs`:

```js
export const itemSha256 = (kind, label, content) => digest({ kind, label, content });
```

To stay byte-identical the adapter reproduces the contract's pure helpers exactly:

| Contract (`justice_upgrade.py`) | Adapter (`src/`) |
| --- | --- |
| `_digest(text)` = `hashlib.sha256(text.encode("utf-8")).hexdigest()` | `canon.mjs` `sha256(text)` |
| `_dump` = `json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=True)` | `canon.mjs` `canonical(value)` |
| `_sanitise` (NFKC, strip invisibles, drop control chars except `\n\t`, `.strip()`) | `package.mjs` `sanitise()` |
| `_check_clean` injection screen (`_CONTROL_PATTERNS`) | `package.mjs` ported `CONTROL_RE` |
| `_URL_RE`, `MAX_EVIDENCE_ITEMS=6`, `MAX_LABEL_CHARS=80`, `MAX_TEXT_EVIDENCE_CHARS=2000`, `MAX_URL_CHARS=400` | `package.mjs` constants + `parseEvidence()` |

Because `sanitise` is idempotent, the already-sanitised `label`/`content` in the bundle hash to
the same values when the contract re-sanitises them in `file_dispute` — the chain reproduces the
bundle's per-item `sha256`.

The whole bundle is bound by **`package_sha256`** = `digest(core)` — the sha256 of the canonical
JSON of every field *except* `package_sha256` itself. One changed byte anywhere is a different
package.

## Bundle shape

`buildPackage({agreement_id, filed_by_role, dispute, evidence})` returns:

- `schema` — `"justice-evidence-package/1"`
- `agreement_id`, `filed_by_role` (`PARTY_A`|`PARTY_B`), `dispute` (sanitised)
- `evidence[]` — each `{kind, label, content, sha256}` (the per-item contract commitment)
- `commitment` — the exact algorithm/formula used, for auditors
- `provenance` — `{assembled_by, assembled_at, tool}` (who assembled it, when)
- `disclosure` — `{note, release_approval}`
- `idempotency.request_key` — a content-only digest; the same dispute always yields the same key
- `relay.evidence_json` — the exact string to pass to `file_dispute(agreement_id, statement, evidence_json)`
- `package_sha256` — the whole-bundle commitment

## CLI

```
justice-odir package <input.json>    # build + print the canonical bundle (with hashes)
justice-odir verify  <bundle.json>   # recompute and check every hash; exit 0 ok, 4 mismatch
justice-odir submit  <bundle.json>   # STUB: prints the genlayer-js calls it WOULD make (no network, no keys)
```

Exit codes: `0` ok/valid · `4` integrity mismatch · `6` bad input · `7` usage.

`submit` is a clearly-marked stub. It performs no network I/O and signs nothing; it reads
`GENLAYER_RPC_URL`, `GENLAYER_CHAIN_ID`, `JUSTICE_CONTRACT_ADDRESS`, `GENLAYER_PRIVATE_KEY` from
the environment and prints the `create_agreement` → `file_dispute` → `resolve_dispute`
`genlayer-js` call sequence. No addresses or keys are hardcoded.

## Worked example

`input.json`:

```json
{
  "agreement_id": "AGR-2026-0007",
  "filed_by_role": "PARTY_A",
  "dispute": "The deliverable was never provided despite full payment.",
  "evidence": [
    { "kind": "text", "label": "Invoice #42", "content": "Paid in full on 2026-01-15." },
    { "kind": "url",  "label": "Public filing", "content": "https://example.com/records/42" }
  ]
}
```

```
$ node bin/justice-odir.mjs package input.json
```

produces (abridged) evidence commitments:

```
evidence[0].sha256 = 7c24be34af3d3ee32ffa379b3983b56c4f72a046c208d41b67d961a1b105df2a
evidence[1].sha256 = 6c1ba102a1db57fb26582498a4883b4b6ef5b1a1a8c1ddc9b388c74b915453fd
```

These equal, byte-for-byte, what CPython computes for the identical input:

```python
import hashlib, json
d = lambda o: hashlib.sha256(json.dumps(o, sort_keys=True, separators=(',',':'), ensure_ascii=True).encode('utf-8')).hexdigest()
d({'kind':'text','label':'Invoice #42','content':'Paid in full on 2026-01-15.'})      # 7c24be34af3d3ee32ffa379b3983b56c4f72a046c208d41b67d961a1b105df2a
d({'kind':'url','label':'Public filing','content':'https://example.com/records/42'})  # 6c1ba102a1db57fb26582498a4883b4b6ef5b1a1a8c1ddc9b388c74b915453fd
```

and are exactly the `sha256` the contract stores in `evidence_json` after `file_dispute`.
`justice-odir verify bundle.json` recomputes every per-item hash, the `package_sha256`, and the
`idempotency.request_key`, and exits non-zero if any fails.

## Tests

```
npm test            # => node --test test/
```

Covers: canonical-JSON parity with CPython vectors (including `ensure_ascii` surrogate-pair
escaping and float refusal), the per-item sha256 cross-check against the contract formula with a
pinned CPython hex, bound/kind/URL/injection validation, `sanitise` idempotency, and `verify()`
round-trip plus tamper detection.

## Dependencies

Zero runtime dependencies — only Node's built-in `node:crypto`. Node ≥ 18.
