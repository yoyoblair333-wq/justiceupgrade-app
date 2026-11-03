# JusticeUpgrade v2 — the courthouse in a contract

**Fast, cheap, impartial dispute resolution that lives entirely on-chain — for the
people and the agents who can never afford a court.**

Most disputes in the world never see a judge. The amounts are too small, the
lawyers too expensive, the courts too slow, the counterparty too far away. A
freelancer stiffed on a $100 logo, a renter owed a deposit, two autonomous agents
that disagree over whether a deliverable met its spec — none of them can
realistically litigate. They either eat the loss or escalate into something ugly.

JusticeUpgrade is a GenLayer Intelligent Contract that gives those disputes a real
forum. Two parties record a plain-language agreement on-chain. If they later
disagree, either party files a dispute **with evidence**, and an on-chain AI
arbiter renders an impartial, reasoned, appealable verdict — a ruling, the
reasoning, and a concrete remedy — that **every GenLayer validator independently
re-judges and must agree on** before it is written to the chain.

It is fast (a judgment is a transaction), cheap (the contract charges **no court
fees** — only normal network gas), impartial (the arbiter is explicitly instructed
not to favor the party who filed), **evidence-grounded** (every exhibit is
committed by sha256, and web links are fetched and read live), **appealable** (a
real ladder from one arbiter to a panel of five), and **precedent-consistent**
(every final ruling is anonymized and published so like cases can be judged
alike). That is what access to justice actually means — and this is a step toward
it, not just a demo.

**#JusticeNeedsAnUpgrade**

---

## Repository layout and how to verify

| Path | What it is |
|---|---|
| `contracts/justice_upgrade.py` | **JusticeUpgrade v2** contract (this milestone) |
| `tests/direct/test_justice_upgrade.py` | v2 direct-mode tests (22) |
| `odir/` | ODIR evidence adapter: canonical, sha256-committed evidence bundles (21 tests) |
| `frontend/` | v2 Next.js web app |
| `v1/contracts/justice_upgrade.py` | the accepted **v1** contract, unchanged; it is the one deployed on studionet at `0x189247716CB87661fDae59aA5fc38eb9df1D9c9c` |
| `v1/tests/direct/` | the v1 test suite (144 tests), still run on every push |
| `web/` | the v1 live web app on GitHub Pages, reading the deployed v1 contract |

One command checks everything from a fresh clone, with no keys:

```bash
bash scripts/verify.sh
```

It lints both contracts, runs the v2, v1 and MilestoneJudge contract tests, the ODIR adapter tests, builds and tests the v1 web app, and does a read-only live check of the deployed v1 contract on studionet. CI also builds the v2 frontend.

---

## What v2 adds over v1

v1 was a clean primitive: one arbiter, one LLM call, a bounded ruling
(`PARTY_A` / `PARTY_B` / `SPLIT` / `INSUFFICIENT_EVIDENCE`), with validator
consensus on that ruling. v2 keeps that core and builds a courthouse around it:

1. **Evidence-bound rulings.** `file_dispute` now carries an evidence list. Each
   item `{kind, label, content}` is committed on-chain by sha256, and the ruling
   is grounded in that committed evidence — tamper-evident and auditable rather
   than a bare opinion. (The evidence-binding discipline is borrowed from ODIR's
   review-package pattern.)
2. **Live web evidence — the flagship.** When an evidence item is a URL, the
   contract itself fetches the page during judgment and every validator
   independently re-fetches and re-judges. A court that can open the link. (See
   [Why this needs GenLayer](#why-this-needs-genlayer) below.)
3. **Due process — an appeal ladder.** 1 arbiter → an independent panel of 3 → a
   panel of 5. A *strict* majority rules; a plurality or a tie falls to the safe
   default; each tier re-judges from scratch and its ruling replaces the prior
   one. Finality requires **both** parties to accept (or a tier-3 ruling, or a
   neutral close by staff) — so neither party can unilaterally foreclose the
   other's appeal.
4. **A precedent ledger.** Every finalized ruling appends a fully anonymized
   precedent — the ruling plus a *deterministic, identity-free* one-line principle
   (no model text, no addresses, no verbatim terms) — to a public, queryable
   ledger, the court's "case law." The ledger carries zero PII by construction.
5. **Fairness safeguards.** Bounded output with a safe default, a neutral stance
   toward the filer, all party text *and* all fetched web text treated as
   untrusted data, and a write-time injection screen that rejects the obvious
   attempts before any model is called.
6. **Orchestration.** An off-chain ODIR adapter packages a dispute's evidence into
   a canonical, sha256-committed bundle whose commitments match the ones the
   contract computes on-chain.

---

## Why this needs GenLayer

An ordinary smart contract can only run deterministic code. It cannot read a
paragraph of terms, weigh a complaint, judge fairness — and it certainly cannot
**open a URL**. GenLayer's GenVM can do both, because an Intelligent Contract
reaches both an LLM and the live web through an **equivalence principle**: the
leader produces a result, and every validator independently re-derives it and
accepts only if it agrees. Nothing is written to chain until the network concurs.

### Live web evidence — the capability only GenLayer has

The flagship of v2. When an exhibit is a URL, the **contract itself** fetches that
page during judgment (`gl.nondet.web.render(url, mode="text")`), folds the fetched
text into the arbiter's prompt as **untrusted data**, and then — this is the part
no ordinary blockchain can do — **every validator re-fetches the same URL and
re-judges from what it sees.** A court that can check whether the file a party
claims to have delivered is actually at the link, whether the public record really
says what a party says it does.

The honest mechanics of making that work:

- **Consensus is on the *ruling*, not the bytes.** Two validators fetching the
  same page, at nearly the same moment, through an LLM, will not produce identical
  prose and may not even see byte-identical HTML. So the contract does **not** try
  to agree on raw page content. It bounds the judgment to a four-value ruling and
  reaches consensus on *that*. The equivalence principle is applied to a
  categorical decision, which is what makes agreement over a live, subjective
  reading tractable. The stored free-text `reasoning` and `resolution` are the
  *leader* arbiter's advisory recommendation surfaced for transparency, not a value
  every validator independently re-agrees on; the binding, re-agreed output is the
  ruling (and, per tier, a well-formed vote distribution).
- **It fails closed.** The validator (`validator_fn`) first rejects any malformed
  payload, then **re-runs the entire panel itself** — re-fetching every URL,
  re-prompting every arbiter — and returns `True` only if its own strict-majority
  ruling equals the leader's. A disagreeing panel, a page that diverges enough to
  flip the ruling, or any exception means **no ruling is written**. Safety over
  liveness.
- **A broken link does not crash the court.** A failed fetch becomes a fixed
  placeholder string (`[the page at this URL could not be retrieved]`) so every
  node sees the same text; the arbiters then judge with that gap acknowledged,
  typically toward `INSUFFICIENT_EVIDENCE`.

This same shape — **bounded categorical output + independent re-judgment, now with
a live-web read inside it** — is reusable for any subjective on-chain decision:
claims triage, content rulings, grant acceptance, eligibility calls.

---

## Contract API

Schema id `justiceupgrade.court.v2`. Rulings are always one of
`PARTY_A`, `PARTY_B`, `SPLIT`, `INSUFFICIENT_EVIDENCE`.

### Lifecycle (write)

| Method | Who may call | What it does |
|---|---|---|
| `create_agreement(agreement_id, party_b, terms)` | anyone (becomes PARTY_A) | Records plain-language `terms` with a counterparty `party_b` (0x + 40 hex). Status → `active`. |
| `file_dispute(agreement_id, statement, evidence_json="")` | PARTY_A or PARTY_B | Files a complaint plus an optional evidence list (see below). Status → `disputed`. |
| `resolve_dispute(agreement_id)` | a party, **or** owner/relayer | Runs the tier-1 arbiter (panel of 1), fetching any URL evidence live. Writes ruling, reasoning, resolution, votes. Status → `ruled`. Returns the full agreement. |
| `appeal(agreement_id)` | PARTY_A or PARTY_B | Escalates to the next, larger independent panel (tier 2 = 3 arbiters, tier 3 = 5). Re-judges from scratch; the appellate ruling replaces the prior one and **resets both parties' acceptances**. Tier 3 auto-finalizes (status → `final`). Returns the full agreement. |
| `accept_ruling(agreement_id)` | PARTY_A or PARTY_B | Records the **calling party's** acceptance of the current ruling. The dispute becomes `final` (and the ruling is recorded as precedent) **only when both parties have accepted** — so one party cannot unilaterally foreclose the other's right to appeal. Returns the full agreement. |
| `finalize(agreement_id)` | owner **or** relayer | A neutral close: ends appeals on a `ruled` dispute (status → `final`) and records the precedent. Reserved for staff; neither party can do this unilaterally. Returns the full agreement. |

### Evidence item shape (`evidence_json`)

A JSON array of up to **6** items. Each item:

| Field | Values | Notes |
|---|---|---|
| `kind` | `"text"` or `"url"` | The two supported exhibit kinds. |
| `label` | string, ≤ 80 chars | A short caption for the exhibit. |
| `content` | string | For `text`: the exhibit text (≤ 2000 chars). For `url`: a single `https://` URL (≤ 400 chars) the contract will fetch live. |

On intake the contract commits each item over a **canonical JSON encoding** of the
whole item —
`sha256(json.dumps({"kind": k, "label": l, "content": c}, sort_keys=True, separators=(",", ":"), ensure_ascii=True))` —
and stores it as the on-chain commitment. (Canonical JSON is used instead of a
`"kind\nlabel\ncontent"` concatenation so a newline inside one field can never
collide with the boundary of another; this is the exact digest the off-chain ODIR
adapter reproduces.) For URL items, the leader's fetched excerpt and its sha256 are
folded back into the stored evidence after judgment, for audit.

### Admin (write, owner-gated)

| Method | What it does |
|---|---|
| `set_relayer(relayer)` | Sets the off-chain relayer address allowed to call `resolve_dispute`. |
| `set_paused(paused)` | Circuit breaker; while paused, writes that mutate disputes are blocked. |
| `transfer_ownership(new_owner)` | Transfers contract ownership. |

### Views (read-only)

| Method | Returns |
|---|---|
| `get_agreement(agreement_id)` | The full record: terms, status, dispute, evidence (with commitments + fetched excerpts), current ruling, votes, each party's acceptance flags (`accepted_a` / `accepted_b`), and the tier-by-tier history. |
| `get_ruling(agreement_id)` | Just the verdict: status, tier, panel size, ruling, reasoning, resolution, votes. |
| `get_precedents(n)` | The most recent `n` anonymized precedents (ruling, tiers, one-line principle, timestamp). |
| `precedent_stats()` | Total precedents and a count by ruling. |
| `get_config()` | Schema, owner/relayer, pause state, the ruling set, tier→panel-size map, arbiter names, evidence kinds, and limits. |

The panel uses five fixed arbiter personas — Ada, Rao, Mei, Ivan, Noa — different
lenses, identical fixed rules. Tier 1 uses the first; tier 2 the first three; tier
3 all five. An odd panel size avoids a structural tie.

---

## Example flow

```python
# PARTY_A records the deal
create_agreement("deal-1", "0xBob...", "Bob pays Alice 100 for a company logo delivered as an SVG by Friday.")

# PARTY_B files a dispute with evidence — a text exhibit and a live link
file_dispute(
    "deal-1",
    "Alice delivered a PNG, not an SVG, and it arrived on Saturday.",
    evidence_json='[{"kind":"text","label":"What was sent","content":"The file Alice sent was a PNG."},'
                  '{"kind":"url","label":"The delivered file","content":"https://files.example.com/logo"}]',
)

# The chain judges it — fetching the URL live, every validator re-judging
resolve_dispute("deal-1")
# -> {"ruling": "PARTY_B", "reasoning": "...", "resolution": "Redeliver an SVG or refund 50.", "tier": 1, ...}

# Not satisfied? Escalate to a panel of three.
appeal("deal-1")   # tier 2 (panel of 3); appeal() again for tier 3 (panel of 5, final).
# To end it short of tier 3, BOTH parties call accept_ruling() (mutual), or staff finalize().
```

---

## Running the direct-mode tests

The contract is **lint-clean and typecheck-clean**, and is covered by a GenLayer
**direct-mode** test suite (the real GenVM Python SDK runs in-process; the LLM is
mocked by regex and the live web fetch is mocked by URL, and `run_nondet_unsafe`'s
captured validator is replayed with `run_validator`). From the repo root:

```bash
pytest tests/direct/test_justice_upgrade.py -v
```

The suite in `tests/direct/` exercises, qualitatively: the text-evidence
resolve-and-consensus flow; the flagship live-web-evidence path (the contract
fetches a URL, the fetched text reaches the arbiter, and an unreachable URL degrades
to a placeholder instead of crashing); the full appeal ladder (overturn at the
panel of three, a 1-1-1 tie resolving to `INSUFFICIENT_EVIDENCE`, a 2-of-5 plurality
*not* deciding, and the panel of five auto-finalizing at tier 3); finality paths
(mutual two-party acceptance with the per-party `accepted_a` / `accepted_b` flags, a
neutral owner `finalize` that a party cannot do unilaterally, and precedent
recording with its fixed, anonymized principle); a validator that **rejects** a
different ruling (real consensus, not a format check); the fairness and access
guards (strangers blocked, injection rejected in terms, dispute text, and evidence);
and the admin / config surface.

---

## Fork it / build on it

This is meant to be forked. Clone it, point it at your own dispute domain (claims
triage, content moderation, grant review, agent-to-agent SLAs), and reuse the
bounded-categorical-output + independent-re-judgment pattern. New to GenLayer? Sign
up with referral code **`JTR01FHP`**.

## Repo layout

- `contracts/justice_upgrade.py` — the v2 Intelligent Contract
- `tests/direct/test_justice_upgrade.py` — the direct-mode test suite
- `frontend/` — a Next.js dApp front end for recording agreements and filing disputes
- `odir/` — the off-chain ODIR adapter that builds the canonical, sha256-committed evidence bundle matching the contract's on-chain commitments
- `docs/MILESTONE.md` — the milestone writeup (aligned to the GenLayer steward rubric)
- `docs/THREAT_MODEL.md` — threats and mitigations

Built on GenLayer's verified SDK patterns (`gl.Contract`, `TreeMap`, `DynArray`,
`@allow_storage` dataclasses, `gl.nondet.exec_prompt`, `gl.nondet.web.render`,
`gl.vm.run_nondet_unsafe`).

#JusticeNeedsAnUpgrade
