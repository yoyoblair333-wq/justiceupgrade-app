# GenLayer portal — Milestone submission form (paste-ready)

> Builder > Milestones. Prepared 2026-11-02. Do NOT reuse an evidence link from
> an earlier submission — everything below is NEW v2 work (commit d58eab0); the
> v1 project submission's links are not reused.

## Linked project

**JusticeUpgrade** (accepted, no milestone currently in review → a milestone is
allowed this week). This is a genuine v2 upgrade of JusticeUpgrade itself, so it
links to its own project — no cross-project mismatch.

## Title

JusticeUpgrade v2 — the courthouse in a contract (live-web evidence + appeals + precedent)

## Description  (974 chars)

JusticeUpgrade v2 turns the minimal AI arbiter into a real, appealable dispute court — an access-to-justice primitive. New: EVIDENCE-BOUND disputes, each item sha256-committed on-chain (canonical JSON), matched byte-for-byte by an off-chain ODIR adapter; LIVE WEB EVIDENCE — when an item is a URL the contract fetches the page during judgment via gl.nondet.web.render and every validator re-fetches and re-judges, consensus on a bounded ruling (only GenLayer reads the web under consensus); a DUE-PROCESS appeal ladder of independent panels (1->3->5 arbiters, strict majority, neutral finalize so neither party can foreclose the other's appeal); an anonymized PRECEDENT ledger for public, consistent case law. Hardened against prompt injection including fetched web text; bounded safe-default; fee-less. genvm-lint + typecheck clean; 22 direct-mode tests incl. the live-web path; adversarially reviewed (Codex), 8 findings fixed; plus a tested ODIR adapter and a Next.js UI.

## Evidence links  (all NEW; GitHub live once pushed; Bradbury tx once deployed)

1. Repo — <JUSTICEUPGRADE_REPO_URL>  (set to the accepted project's GitHub repo once the v2 commit is pushed there)
2. v2 commit — <JUSTICEUPGRADE_REPO_URL>/commit/d58eab0  ("JusticeUpgrade v2: the courthouse in a contract")
3. Contract — .../blob/d58eab0/contracts/justice_upgrade.py
4. Direct-mode tests — .../blob/d58eab0/tests/direct/test_justice_upgrade.py
5. ODIR evidence adapter — .../blob/d58eab0/odir/
6. Milestone writeup — .../blob/d58eab0/docs/MILESTONE.md
7. On-chain evidence — <BRADBURY_DEPLOY_TX>  (GenLayer Bradbury testnet, chain 4221; filled after deploy — pending Blair's faucet)

## Why this scores (steward rubric)

- Impact/usefulness: fast, cheap, impartial, evidence-grounded, appealable dispute resolution for people and agents who can't afford courts.
- Effort/Scope: a hardened 14-method contract + ODIR adapter + full frontend + docs + 22 tests, not a tweak.
- Quality: lint/typecheck clean, real consensus (not schema-only), adversarially reviewed with every finding fixed.
- Community impact: a reusable, forkable justice primitive showcasing GenLayer's unique web-under-consensus capability.

## Captcha

reCAPTCHA ("I'm not a robot") — left for Blair to tick. Do not submit.

## Open dependencies (Blair / app-side Claude)

1. PUSH the v2 commit d58eab0 to the accepted JusticeUpgrade GitHub repo (this local repo has no remote yet — need the repo URL), which also produces the v1->v2 diff.
2. DEPLOY to Bradbury testnet for the on-chain evidence tx (needs the faucet captcha); then fill evidence link 7.
