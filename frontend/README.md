# JusticeUpgrade v2 — frontend dApp

**#JusticeNeedsAnUpgrade — a courthouse in a contract.**

A Next.js frontend for the **JusticeUpgrade v2** GenLayer Intelligent Contract
(`justice_upgrade.py`, class `JusticeUpgrade`). Two parties record a
plain-language agreement on-chain. Either party files a dispute **with
evidence**. An on-chain AI **panel** — LLMs running inside the GenVM under the
equivalence principle — renders a bounded, reasoned, **appealable** verdict, and
every finalized ruling becomes public **precedent**.

This app is adapted from GenLayer's official project boilerplate and mirrors its
stack and patterns: Next.js 16 + React 19 + TypeScript, Tailwind CSS v4, Radix
UI, TanStack Query, viem/wagmi, MetaMask, and the `genlayer-js` SDK.

### What v2 surfaces

- **Evidence-bound disputes.** A dispute carries up to six evidence items, each
  either free text or a single `https` URL, with a short label. Each is
  committed by sha256 — tamper-evident and auditable.
- **Live web evidence (the flagship).** A URL evidence item is opened *by the
  contract itself* during the ruling (`gl.nondet.web.render`); the verdict is
  grounded in what the chain actually fetched, and every validator independently
  re-fetches and re-judges. The UI shows the stored `fetched_excerpt` +
  `fetched_sha256` prominently — a chain that opened the link.
- **Appeal ladder.** A losing party can escalate to a larger independent panel:
  tier 1 (1 arbiter) → tier 2 (3) → tier 3 (5). Each tier re-judges from scratch.
- **Precedent browser.** Every finalized ruling appends an anonymized precedent
  (ruling + one-line principle); the UI lists them and shows counts by ruling.

---

## What the app does

The UI drives every callable method on the contract:

| UI flow | Contract method | Kind |
| --- | --- | --- |
| Connect wallet (MetaMask + GenLayer network) | — | — |
| **Record an agreement** (ID, counterparty, terms) | `create_agreement(agreement_id, party_b, terms)` | write |
| **File a dispute with evidence** (ID, statement, evidence) | `file_dispute(agreement_id, statement, evidence_json)` | write |
| **Get the ruling** (ID → AI verdict) | `resolve_dispute(agreement_id)` | write (LLM) |
| **Appeal** (escalate to a larger panel) | `appeal(agreement_id)` | write (LLM) |
| **Accept ruling** (make final → precedent) | `accept_ruling(agreement_id)` | write |
| **Track an agreement** (status, evidence, verdict, appeal history) | `get_agreement(agreement_id)` | view |
| Verdict read-back after a panel runs | `get_ruling(agreement_id)` | view |
| **Precedent browser** (public case law) | `get_precedents(n)` / `precedent_stats()` | view |
| Court configuration (tiers, arbiter names) | `get_config()` | view |

`evidence_json` is a JSON string of an array of
`{kind:"text"|"url", label, content}`; the client serializes the evidence form
to exactly this shape (the contract adds the sha256 and fetched fields on-chain).

The arbiter returns one of four bounded rulings — `PARTY_A`, `PARTY_B`, `SPLIT`,
or `INSUFFICIENT_EVIDENCE` — plus free-text reasoning and a recommended
resolution. Bounding the ruling to a small categorical set is what lets
validators reach consensus on a subjective AI judgment. The status flow is
`active → disputed → ruled → final`.

---

## Prerequisites

1. **MetaMask** installed in your browser.
2. The **JusticeUpgrade contract deployed** to GenLayer (Studio or your own
   node). Deploying `justice_upgrade.py` returns a contract address.

---

## Configure the contract address

The frontend reads the deployed address from
`NEXT_PUBLIC_JUSTICE_CONTRACT_ADDRESS` (falling back to the legacy
`NEXT_PUBLIC_CONTRACT_ADDRESS` if only that is set).

> **The v2 contract is not deployed yet.** `.env.example` ships this variable
> **empty on purpose** — do not invent an address. With no address set, the app
> stays fully up as a read-only preview: a clear "Contract not deployed yet"
> banner is shown and every on-chain read/write is disabled until you fill it in.

1. Copy the example env file:

   ```bash
   cp .env.example .env
   ```

2. Once the contract is deployed, set the returned address:

   ```bash
   NEXT_PUBLIC_JUSTICE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
   ```

The other variables default to the hosted GenLayer Studio and usually need no
change:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | `https://studio.genlayer.com/api` | GenLayer RPC endpoint |
| `NEXT_PUBLIC_GENLAYER_CHAIN_ID` | `61999` | GenLayer chain ID (for the MetaMask network) |
| `NEXT_PUBLIC_GENLAYER_CHAIN_NAME` | `GenLayer Studio` | Network name shown in MetaMask |
| `NEXT_PUBLIC_GENLAYER_SYMBOL` | `GEN` | Native currency symbol |
| `NEXT_PUBLIC_JUSTICE_CONTRACT_ADDRESS` | _(empty — v2 not deployed)_ | Deployed JusticeUpgrade v2 address |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | _(empty)_ | Legacy/fallback address (v1) |

Only a well-formed `0x…` 40-hex address counts as configured; a placeholder or
empty value degrades to the read-only "set the address" state. Writes always
require a connected wallet in addition to a configured address.

---

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, connect MetaMask (the app will prompt to add/switch
to the GenLayer network), and use the three flows on the page.

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # type-check with tsc --noEmit
```

---

## How it talks to GenLayer

All contract access goes through `genlayer-js`, following the boilerplate's
`FootballBets.ts` pattern. The binding lives in
`lib/contracts/JusticeUpgrade.ts`:

```ts
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const client = createClient({ chain: studionet, account, endpoint });

// view
const result = await client.readContract({
  address, functionName: "get_agreement", args: [agreementId],
});

// write
const txHash = await client.writeContract({
  address, functionName: "create_agreement",
  args: [agreementId, partyB, terms], value: BigInt(0), fees,
});
await client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" });
```

- **Views** (`get_agreement`, `get_ruling`) return a `dict`, which `genlayer-js`
  decodes as a `Map`; a `normalize()` helper converts it (recursively) to a
  plain typed object.
- **Writes** estimate fees with the shared fee-preset helpers
  (`lib/genlayer/fees.ts`), submit via `writeContract`, and wait for an
  `ACCEPTED` receipt.
- `resolve_dispute` is the slow, LLM-backed write (longer receipt timeout); the
  verdict is read back from on-chain storage with `get_ruling` rather than
  parsed out of the receipt.

React Query hooks in `lib/hooks/useJusticeUpgrade.ts` wrap these calls and
invalidate the relevant queries after each write.

---

## Project structure

```
justice-dapp/
├── app/
│   ├── globals.css        # GenLayer brand theme (Tailwind v4) — reused from boilerplate
│   ├── layout.tsx         # Root layout + JusticeUpgrade metadata
│   ├── page.tsx           # Single-page app: hero + the three flows
│   └── providers.tsx      # QueryClient + WalletProvider + Toaster
├── components/
│   ├── AccountPanel.tsx         # MetaMask connect/switch/disconnect (adapted)
│   ├── AddressDisplay.tsx       # reused from boilerplate
│   ├── AgreementViewer.tsx      # get_agreement + resolve/appeal/accept + verdict
│   ├── AppealLadder.tsx         # tier ladder (1→3→5) + ruling history
│   ├── ContractBanner.tsx       # "not deployed / set the address" degraded state
│   ├── EvidenceInput.tsx        # evidence editor → evidence_json (dispute form)
│   ├── EvidenceList.tsx         # evidence display incl. live-web-evidence panel
│   ├── FileDisputeForm.tsx      # file_dispute (with evidence)
│   ├── JusticeLogo.tsx          # JusticeUpgrade brand mark
│   ├── Navbar.tsx               # glassy navbar (adapted)
│   ├── PanelVotes.tsx           # individual panelist votes
│   ├── PrecedentBrowser.tsx     # get_precedents + precedent_stats (case law)
│   ├── RecordAgreementForm.tsx  # create_agreement
│   ├── RulingBadge.tsx          # ruling/status badges + shared ruling metadata
│   └── ui/                      # Radix + Tailwind primitives (reused)
├── lib/
│   ├── contracts/
│   │   ├── JusticeUpgrade.ts    # genlayer-js contract binding (v2 surface)
│   │   └── types.ts             # Agreement / Evidence / Precedent / Config types
│   ├── genlayer/                # client, wallet, fees (reused from boilerplate)
│   ├── hooks/useJusticeUpgrade.ts
│   └── utils/
├── .env.example
├── package.json
└── ...config (tsconfig, next.config, tailwind.config, postcss, components.json)
```

---

## Notes & assumptions

- Chain ID `61999` and the Studio RPC are the boilerplate defaults; change them
  in `.env` if you deploy to a different GenLayer network.
- The contract validates the counterparty with `Address(party_b)`, so the
  "counterparty" field expects a standard `0x…` 40-hex-character address; the
  form validates this client-side.
- `resolve_dispute` can only run while an agreement is in the `disputed` state;
  `appeal` and `accept_ruling` only while it is `ruled`; and only a party to the
  agreement may call them — the UI surfaces each action only for the matching
  status and relies on the connected wallet being a party.
- `resolve_dispute` and `appeal` are the slow, LLM-backed writes (fees estimated
  via the shared presets, longer receipt timeouts). Any `https` URL evidence is
  fetched live *inside* those calls by the contract, and the fetched excerpt +
  sha256 are read back from `get_agreement` and shown in the evidence panel.

Powered by [GenLayer](https://genlayer.com).
