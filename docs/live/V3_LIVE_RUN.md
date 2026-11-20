# JusticeUpgrade v3 live run on GenLayer studionet (2026-11-20)

Contract **`0x7D985d8cBE1CC67B36e846065a88C0B77520480A`** (schema `justiceupgrade.court.v3`, response window 300 s for the demo;
the production default is 72 h). [Explorer](https://explorer-studio.genlayer.com/address/0x7D985d8cBE1CC67B36e846065a88C0B77520480A) ·
[open in Studio](https://studio.genlayer.com/?import-contract=0x7D985d8cBE1CC67B36e846065a88C0B77520480A) · case viewer:
https://yoyoblair333-wq.github.io/justiceupgrade-app/v3/ · ownership transferred to
`0x920fbbCf2106B693A857D1995c198e341220a46A`.

Raw records: [`v3-studionet-run.json`](v3-studionet-run.json) (deploy, laptop-1,
default-1) and [`v3-studionet-run-ship.json`](v3-studionet-run-ship.json) (ship-1).
Evidence pages are pinned by commit under `docs/live/evidence-v3/`.

## ship-1: the respondent's answer decides the case

Dev (party B) files: the lens "never arrived", full refund. Cara (party A, the
respondent) answers with the carrier tracking page as a **live URL**. The contract
fetched it during judgment and every validator re-fetched it.

| Step | Tx | Consensus |
|---|---|---|
| create_agreement | `0x886349d6b0f0c8da6aa0bd989dcf70dae92b09a3e48c57297ee737d8def862bd` | ACCEPTED / MAJORITY_AGREE (3 agree, 2 idle) |
| file_dispute (Dev) | `0x6e6a3c9acb5489e0784afb6e8d4344eda132270050d8055f3c7888fb8982b68e` | ACCEPTED / MAJORITY_AGREE (3 agree, 2 idle) |
| **respond_to_dispute** (Cara, live URL) | `0xe52ab1325d4d8160199020c0b037e367a7495bda848a9f1d233f0d1f35e3dcc6` | ACCEPTED / MAJORITY_AGREE (3 agree, 2 idle) |
| resolve_dispute | `0x35fe4dd97592251f49258f587f40c12ef6ce65ae7f76700c33d63677728e3afe` | ACCEPTED / MAJORITY_AGREE (3 agree, 2 idle) |

Ruling **PARTY_A** (the respondent). Remedy: deny the 120 GEN refund. The arbiter also
noted that the tracking page names the sender as "Ana" rather than Cara and weighed it
explicitly: a typo in our test page, read carefully rather than glossed over.

## default-1: no answer, so a flagged default proceeding

| Step | Tx | Consensus |
|---|---|---|
| file_dispute (Ben) | `0x7ff0c3700c3d104f58494daa17af7bed63eafca954234f056f05e0726408f145` | ACCEPTED / MAJORITY_AGREE (5 agree) |
| resolve_dispute after the window | `0xb7193f7d8d8387964ef8045c616040157e1953f7c4289fd4f6147b6f169dd21a` | ACCEPTED / MAJORITY_AGREE (2 idle, 3 agree) |

Ruling **PARTY_B**, `default_proceeding: true`. The ruling rests on the filer's own
evidence (6 of 10 icons delivered) and orders delivery of the remaining 4.

## laptop-1: window gate, answer, a split panel, then settlement

| Step | Tx | Consensus |
|---|---|---|
| create_agreement | `0x535f0eae39a0dbb0a23b473d1a218cb326c8c78365f4b990653d5e425d3cd7ce` | ACCEPTED / MAJORITY_AGREE (2 idle, 3 agree) |
| file_dispute (Ben, live URL) | `0xf4c06eb43c73ae2d9208d40b0487e27562ee134f9862d53d9c73913959f25d00` | ACCEPTED / MAJORITY_AGREE (5 agree) |
| resolve_dispute before an answer: **refused**, `[JUSTICE] the respondent's answer window is still open` | `0xa138104f2a877305caf861b1a4dbe9fd37f29e207cf7cf29c2afde7a9b85e52d` | ACCEPTED / MAJORITY_AGREE (5 agree) |
| respond_to_dispute (Ana, live URL + text) | `0x9c284969981ae3c51e6bba5a320ebba2449a91962218ad7f0d3700b111385950` | ACCEPTED / MAJORITY_AGREE (4 agree, 1 idle) |
| resolve_dispute | `0x516c059eee033c88be015f36ca472c9054ea9962eb2349762791e1867947f6ab` | UNDETERMINED / MAJORITY_DISAGREE (2 agree, 3 disagree) |
| propose_settlement (SPLIT) | `0x8554fe4658b192a316a25a9ef591baf35bb2212ed56f15cf3fa7d4f3b1aff9d9` | ACCEPTED / MAJORITY_AGREE (2 idle, 3 agree) |
| accept_settlement | `0x40f074daa00091cebe877b49ff998411bcca7845c2246aa3e786e74aeb588403` | ACCEPTED / MAJORITY_AGREE (5 agree) |

The laptop case is genuinely close (light use vs. heavy use against "about 3 hours of
light use"). The validators did not reach the same ruling, so **no ruling was written**
(the court fails safe). The parties then settled on a SPLIT: status `settled`, no
model call, and the public ledger gained its first anonymized "settled" precedent.

Ownership: | transfer_ownership | `0x2153eb0bc0d359f26386e16b2eac5c5797efc4871dd50cad4f56eba55fe46a41` | ACCEPTED / MAJORITY_AGREE (5 agree) |
