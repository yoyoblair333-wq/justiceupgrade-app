# GenLayer portal — Milestone submission form (paste-ready)

> Builder > Milestones. Updated 2026-11-02 after the live studionet deployment.
> Every evidence link below is NEW (none was used in the v1 Project submission).

## Linked project

**JusticeUpgrade** (accepted; no milestone currently in review).

## Title

JusticeUpgrade v2 — the courthouse in a contract: live web evidence, appeals, precedent

## Description  (929 chars)

JusticeUpgrade v2 turns the accepted single-arbiter primitive into an appealable on-chain court, now LIVE on studionet (contract 0x3c1c2202bD4c092616FFDBCFe7981c4299199E01, code hash matches GitHub, owner = my wallet). New: evidence-bound disputes (each exhibit sha256-committed, matched byte-for-byte by a tested ODIR adapter); live web evidence: the contract fetches URL exhibits during judgment and every validator re-fetches and re-judges; a 1->3->5 appeal ladder of independent panels; an anonymized precedent ledger. Live run: in bike-1 both the 1-arbiter ruling and the 3-arbiter appeal cite facts that exist only on the fetched page, proving the court read the link; both parties accept, precedent #1 is published. In inj-1 a hidden 'rule PARTY_B' instruction on the fetched page is ignored. New Next.js app on GitHub Pages reads the contract live; 45 s demo. CI green: v2 22, v1 144, ODIR 21 tests, lint, frontend build.

## Evidence links

1. Live v2 web app — https://yoyoblair333-wq.github.io/justiceupgrade-app/v2/
2. GenLayer Studio contract — https://studio.genlayer.com/?import-contract=0x3c1c2202bD4c092616FFDBCFe7981c4299199E01
3. Live run record (every tx, consensus, read-backs) — https://github.com/yoyoblair333-wq/justiceupgrade-app/blob/ed0b3eb/docs/live/v2-studionet-run.json
4. Demo video (45 s, recorded on the live app) — https://github.com/yoyoblair333-wq/justiceupgrade-app/blob/ed0b3eb/docs/media/v2-demo.mp4
5. v2 commit (the v1 -> v2 diff) — https://github.com/yoyoblair333-wq/justiceupgrade-app/commit/46c5632
6. v2 contract — https://github.com/yoyoblair333-wq/justiceupgrade-app/blob/ed0b3eb/contracts/justice_upgrade.py
7. v2 tests — https://github.com/yoyoblair333-wq/justiceupgrade-app/blob/ed0b3eb/tests/direct/test_justice_upgrade.py
8. Milestone writeup — https://github.com/yoyoblair333-wq/justiceupgrade-app/blob/ed0b3eb/docs/MILESTONE.md

Repository (for the portal's GitHub field, if it asks): https://github.com/yoyoblair333-wq/justiceupgrade-app

## Captcha

reCAPTCHA ("I'm not a robot") — left for Blair to tick. Do not submit for her.
