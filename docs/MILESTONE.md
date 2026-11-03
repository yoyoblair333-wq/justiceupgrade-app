# Milestone: JusticeUpgrade v2 — "the courthouse in a contract"

**Date:** 2026-11-02
**Contract:** `contracts/justice_upgrade.py` (schema id `justiceupgrade.court.v2`)
**Status:** compiles, lints, typechecks, and passes its direct-mode test suite.
**Deployment:** not yet deployed. The milestone evidence is the GitHub diff until
the contract is deployed to the GenLayer **Bradbury** testnet (see
[Evidence](#verifiable-evidence)).

This writeup is organized around the GenLayer steward review rubric:
**Impact / usefulness · Effort · Scope · Quality · Community impact.** Each section
makes the honest case for that criterion, followed by *what's new beyond v1* and
the verifiable evidence list.

---

## Impact / usefulness

Most disputes in the world are never adjudicated — not because they lack merit, but
because the cost and friction of a court dwarf the amount in dispute. Small
freelance jobs, deposits, marketplace orders, and, increasingly, **disagreements
between autonomous agents** that transact faster and more often than any human
court could ever serve.

JusticeUpgrade is a concrete, usable forum for exactly those disputes:

- **Fast and cheap.** A judgment is a single transaction. The contract charges
  **no court fees** — participants pay only ordinary network gas. That changes the
  economics for the small disputes that are priced out of real courts.
- **Impartial and evidence-grounded.** The arbiter is explicitly told not to favor
  the party who filed, and the ruling is grounded in evidence that is committed
  on-chain by sha256 — so the verdict is auditable, not a bare opinion.
- **Appealable.** A losing party is not stuck with one model's call; they can
  escalate to larger, independent panels (1 → 3 → 5).
- **Consistent.** Finalized rulings publish an anonymized precedent, so the court
  can judge like cases alike and anyone can audit its body of decisions.

The usefulness is not hypothetical to GenLayer's own thesis. GenLayer positions
itself as the adjudication layer for the agentic economy; an on-chain court that
can read agreements, weigh evidence, **open the links a party cites**, and reach
validator consensus on a verdict is a direct, load-bearing instance of that thesis
rather than a toy. The same primitive — bounded categorical output + independent
re-judgment, with a live-web read inside it — generalizes to claims triage, content
rulings, grant acceptance, and eligibility decisions.

## Effort

v2 is a substantial build on top of a working v1 primitive, not a reskin:

- **A full appeal state machine.** `active → disputed → ruled → final`, with
  tier-indexed panels (`TIER_ARBITERS = {1: 1, 2: 3, 3: 5}`), re-judgment from
  scratch at each tier, the appellate ruling replacing the prior one (and resetting
  both parties' acceptances), and a tier-by-tier history record. Finality is
  deliberately hard to reach unilaterally: it requires **both parties to accept**
  (`accept_ruling` records one side at a time), *or* a neutral close by staff
  (`finalize`, owner/relayer only), *or* a tier-3 auto-finalize — so one party can
  never foreclose the other's right to appeal. A panel decides only on a **strict
  majority** (more than half); a plurality or a tie resolves to the safe default
  with deterministic neutral reasoning and resolution.
- **An evidence pipeline.** Intake validation and sanitization for a typed evidence
  list (text and URL kinds, per-kind size and format limits, label caps),
  per-item sha256 commitments, and a canonical commitment format shared with the
  off-chain adapter.
- **Live web fetch inside the non-deterministic block.** The whole panel — URL
  fetch plus every arbiter prompt — lives directly in `leader_fn` so the GenVM
  linter can see the non-deterministic calls are reachable, with a real
  `validator_fn` that re-runs the panel and agrees only on the bounded ruling.
- **A precedent ledger** with anonymization at write time, plus queryable views
  and aggregate stats.
- **A hardened input surface.** Unicode NFKC normalization, invisible-character
  stripping, a regex injection screen applied to terms, dispute text, and every
  evidence label and text body, strict `0x`-address validation, and an
  `https://`-only URL validator.
- **A direct-mode test suite** covering the flows above (see Quality), and a
  Next.js front end in `frontend/` for recording agreements and filing disputes.

## Scope

The milestone is scoped to a coherent, self-contained unit of work:

- **In scope and delivered:** the v2 contract and its full lifecycle; evidence
  commitments; live web evidence with validator re-judgment; the appeal ladder;
  the precedent ledger; the fairness and access-control safeguards; the admin
  surface (owner/relayer, pause, ownership transfer); the direct-mode test suite;
  the documentation set (this file, the README, and the threat model).
- **Deliberately bounded:** the ruling set is four fixed values; panels cap at five
  arbiters over three tiers; evidence is capped at six items with per-kind size
  limits. These bounds are design choices, not gaps — a small categorical output
  and a bounded panel are precisely what make validator consensus over a subjective,
  live reading tractable.
- **Out of scope for this milestone (named honestly):** on-chain deployment and a
  live transaction (pending, see below); any escrow or value transfer (the court
  rules; it does not hold funds); and jury/token-curated panels, which the fixed
  persona panel is a deliberate first step toward.

## Quality

- **Clean build.** The contract **lints and typechecks cleanly** and compiles under
  the GenVM Python SDK.
- **Real consensus, tested.** The direct-mode suite in `tests/direct/` runs the
  actual GenVM SDK in-process, mocks the LLM by regex and the web fetch by URL, and
  replays the captured validator. It asserts the validator **rejects** a run whose
  re-judgment yields a different ruling — i.e. consensus is enforced on the decision,
  not merely on output format.
- **Coverage, described qualitatively** (no invented counts — see the suite in
  `tests/direct/`): the text-evidence resolve-and-consensus flow; the flagship
  live-web path (the contract fetches a URL; the fetched text provably reaches the
  arbiter prompt; an unreachable URL degrades to a placeholder instead of crashing);
  the full appeal ladder (overturn at the panel of three, a 1-1-1 tie resolving to
  the safe default, a 2-of-5 plurality that is *not* a strict majority resolving to
  the safe default with neutral text, and tier 3 auto-finalizing and refusing
  further appeal); the finality paths (mutual two-party `accept_ruling` with the
  per-party acceptance flags, the owner/relayer-only neutral `finalize` that a party
  cannot invoke, and precedent recording with its fixed anonymized principle); the
  fairness and access guards (strangers blocked from dispute/resolve/appeal/accept,
  injection rejected across terms, dispute text, and evidence; evidence validation
  for bad kinds, insecure URLs, and over-limit item counts); and the config surface.
- **Fail-closed by construction.** Malformed arbiter output coerces to the safe
  default `INSUFFICIENT_EVIDENCE`; a disagreeing panel or any exception writes no
  ruling. Safety is preferred over liveness throughout.
- **Documented.** API table, a candid "why it needs GenLayer / live web evidence"
  section, and a standalone threat model (`docs/THREAT_MODEL.md`).

## Community impact

- **Forkable template.** The repo is structured to be cloned and retargeted —
  contract, tests, and a working front end — so other builders can stand up a
  domain-specific on-chain court (claims, moderation, grants, agent SLAs) quickly.
  Referral code **`JTR01FHP`** is published in the README for new builders.
- **A reusable pattern, not just an app.** The "bounded categorical output +
  independent re-judgment, with a live-web read inside the consensus block" shape is
  documented explicitly so it can be lifted into other GenLayer contracts.
- **Demonstrates the live-web capability** that most distinguishes GenLayer from
  ordinary chains, in a way that is easy to reason about and to show.
- **Honest about its limits**, which is itself a contribution: the docs state
  plainly that consensus is on the ruling (not raw bytes) and that a page changing
  between fetches fails the dispute closed — useful guidance for anyone building on
  the same primitive.

---

## What's new beyond v1

| Area | v1 | v2 |
|---|---|---|
| Evidence | none (statement only) | typed evidence list, canonical-JSON sha256-committed on-chain (adapter-reproducible) |
| Web | none | **contract fetches URL evidence live; every validator re-fetches and re-judges** |
| Appeals | none | ladder: 1 → 3 → 5 arbiters, **strict** majority rules, plurality/tie → safe default, replace-prior-ruling |
| Panel | 1 arbiter | 5 fixed personas, tier-indexed panel size |
| Precedent | none | fully anonymized public ledger (deterministic per-ruling principle, zero PII) + queryable stats |
| Finality | resolved-is-final | mutual two-party `accept_ruling`, neutral staff `finalize`, or tier-3 auto-finalize — no unilateral foreclosure |
| Injection defense | basic | NFKC + invisible-char strip + regex screen across terms, dispute, and evidence, plus delimiter-neutralisation of all untrusted text (incl. fetched web pages) |
| Orchestration | none | off-chain ODIR adapter: canonical sha256-committed evidence bundle matching on-chain commitments |

## Verifiable evidence

Stewards reward *legitimate, verifiable* evidence. For this milestone:

- **Primary evidence (available now): the GitHub diff.** The complete v1 → v2 change
  — contract, tests, front end, and docs — is the reviewable artifact for this
  milestone. Every claim in this writeup is checkable against
  `contracts/justice_upgrade.py` and `tests/direct/test_justice_upgrade.py`.
- **Test evidence.** The direct-mode suite in `tests/direct/` runs with
  `pytest tests/direct/test_justice_upgrade.py -v` and exercises the flows above,
  including the enforced consensus check.
- **Deployment target (pending): GenLayer Bradbury testnet.** Bradbury is the
  evidence standard for a deployed milestone: **chain id 4221**, faucet at
  `testnet-faucet.genlayer.foundation`. Studionet is used only for local iteration;
  the testnet transaction is what counts as on-chain evidence. **No deployment has
  happened yet**, so there is **no transaction hash to cite**. When the contract is
  deployed to Bradbury, the deploy transaction and a sample `resolve_dispute` /
  `appeal` transaction should be added here as the on-chain evidence.

> Truthful status, stated plainly: (a) the contract compiles, lints, typechecks,
> and passes its direct-mode tests; (b) it has **not** been deployed, so there is no
> tx hash, point value, or on-chain record yet. Nothing in this document should be
> read as claiming otherwise.

#JusticeNeedsAnUpgrade
