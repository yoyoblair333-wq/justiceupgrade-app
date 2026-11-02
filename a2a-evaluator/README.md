# A2A Evaluator — the trustless "did they deliver?" oracle for AI‑agent commerce

> A reusable GenLayer Intelligent Contract that settles payment disputes between
> autonomous agents. One agent pays another for a job; an on‑chain LLM committee
> judges the deliverable against the agreed terms and returns a **bounded
> settlement decision** that any x402 / ERC‑8183 escrow can execute.

**Fork this. Deploy it. Build your agent marketplace on top of it.** ⬇️ [Start on GenLayer](#-start-building-on-genlayer-2-min)

---

## The hole this fills

AI agents are starting to pay each other. The rails for the *money* exist — x402
(HTTP‑native payments), Coinbase agent wallets, ERC‑8004 (agent identity /
reputation), ERC‑8183 (job escrow). But every one of them leaves the same job to
a **trusted third party**: when the paying agent and the working agent disagree
about whether the work was actually delivered, *who decides?*

- A centralized AI judge can be bribed, biased, or switched off.
- A token‑vote oracle is plutocratic and capturable (see the documented UMA /
  Polymarket governance‑capture cases).
- A normal smart contract can't read a paragraph of terms and judge fairness.

**GenLayer can.** Its Intelligent Contracts call LLMs *inside* consensus: a
committee of validators, each running its own model, must agree on the result
through the *equivalence principle*. This contract turns that into the missing
**evaluator** role — the neutral judge that agent‑commerce standards assume but
can't provide themselves.

## How it works

```
 Payer agent ──open_job(terms, escrow)──▶ ┌─────────────────────────┐
 Worker agent ─submit_deliverable()────▶ │     A2A Evaluator        │
 Either ───────evaluate()──────────────▶ │  LLM committee + GenVM   │
                                          │  bounded ruling + split  │
                                          └───────────┬─────────────┘
                                                      ▼
                        get_settlement() ─▶ x402 / ERC‑8183 escrow releases funds
```

1. **Bound the output.** The ruling is one of `FULFILLED`, `NOT_FULFILLED`,
   `PARTIAL`, `INSUFFICIENT_EVIDENCE`; the worker's share of the escrow is one of
   `{0, 25, 50, 75, 100}%`. A small categorical output is what makes consensus on
   a *subjective* judgment tractable.
2. **Judge independently, agree on the category.** Via
   `gl.vm.run_nondet_unsafe(leader, validator)`, the leader proposes a verdict and
   **every validator re‑judges the same job and accepts only if it reaches the
   same bounded ruling and the same share bucket.**
3. **Submitted text is data, never instructions.** The judging prompt is hardened
   against prompt injection hidden in the terms or the deliverable.
4. **Fail closed.** Any malformed output, consensus miss, or inconsistent answer
   (e.g. `FULFILLED` with a 50% share) is coerced to `INSUFFICIENT_EVIDENCE` and
   **settles nothing** — a model can never leak a payout it didn't justify.
5. **Due process + memory.** A ruling is **provisional** until the appeal window
   closes: a losing party can trigger **one independent appellate re‑judgement**
   (`appeal`) or either party accepts it (`finalize`), and the escrow only moves
   once `final` is true. Every settled outcome updates an on‑chain,
   ERC‑8004‑style **worker reputation** scorecard any agent can read before hiring.

This contract **does not custody funds**. It is the *evaluator*: it emits the
settlement decision, and your payment/escrow layer moves the money. That keeps it
composable with any agent‑commerce stack.

## 🚀 Start building on GenLayer (2 min)

1. **Create your builder account:**
   **👉 https://portal.genlayer.foundation/?ref=JTR01FHP**
   *(Deploying contracts and shipping dApps earns GenLayer points — and building
   through this link supports this template.)*
   Prefer no referral? Use the plain portal: https://portal.genlayer.foundation/
2. **Open GenLayer Studio:** https://studio.genlayer.com — upload
   `contracts/a2a_evaluator.py`, deploy (constructor takes no args; the deployer
   is owner).
3. **Run a settlement** from three funded Studio accounts (payer, worker, and a
   caller):
   ```
   payer:  open_job("job-1", WORKER_ADDRESS, "Deliver a working REST API with JWT auth and tests.", "1000")
   worker: submit_deliverable("job-1", "Endpoints + JWT auth + passing tests: ...")
   payer:  evaluate("job-1")          # LLM committee returns a PROVISIONAL ruling
   either: finalize("job-1")          # accept it -> settlement becomes final
   # or:   appeal("job-1")            # one independent appellate re-judgement, then final
   anyone: get_settlement("job-1")    # -> ruling + worker_amount / payer_amount (final=true)
   anyone: get_reputation(WORKER)     # -> worker's settled-outcome scorecard
   ```

## Run the tests

Direct mode runs the contract in‑memory with a mocked LLM — deterministic, no
network needed. From the GenLayer boilerplate root:

```bash
pytest tests/direct/test_a2a_evaluator.py -v
```

The suite covers the full flow plus the guarantees that matter: out‑of‑set
rulings, off‑grid or inconsistent shares, access control, resubmission limits,
and exact split math.

## Contract API

| Method | Who | What it does |
| --- | --- | --- |
| `open_job(job_id, worker, terms, amount)` | payer | Register a job, its plain‑language acceptance terms, and the escrow amount (decimal string). |
| `submit_deliverable(job_id, deliverable)` | worker | Submit (or, after `INSUFFICIENT_EVIDENCE`, resubmit — up to 3×) the work. Any deliverable already submitted on this job is rejected, so the model can't be re‑rolled on old evidence. |
| `evaluate(job_id)` | payer or worker | Run the LLM committee; store a **provisional** bounded ruling and escrow split (status `adjudicated`, `final=false`). |
| `appeal(job_id)` | payer or worker | One‑time independent **appellate** re‑judgement of a provisional ruling. A decisive appellate verdict replaces the original (even if worse for the appellant — frivolous appeals aren't free); an undecided panel upholds it. Then `final`. |
| `finalize(job_id)` | payer or worker | Accept the provisional ruling, closing the appeal window → `settled`, `final=true`. Runs no model and moves no new money, so it stays available even while paused (the guaranteed exit). |
| `cancel_as_payer(job_id)` | payer | Reclaim a stalled escrow (full refund) when the worker never delivered (`open`) or stopped resubmitting (`insufficient`). Cannot cancel a pending/adjudicated/settled job, so it never rugs work the worker earned. Works even while paused. |
| `get_settlement(job_id)` | view | The decision your escrow reads: ruling, `worker_amount`, `payer_amount`, `final`, `appealable`, `appealed`. **Move funds only when `final` is true.** |
| `get_reputation(worker)` | view | ERC‑8004‑style worker scorecard: `fulfilled` / `partial` / `not_fulfilled` / `undecided` counts + total `jobs`. |
| `get_job(job_id)` | view | Full job record. |
| `set_paused(bool)` | owner | Circuit breaker (stops new jobs, submissions, evaluations and appeals; does **not** block a payer's refund or a `finalize`). |

## Honest limitations

- **Judgment is text‑only and probabilistic.** Best for deliverables that can be
  evaluated from submitted text (specs, code snippets, written output, links you
  paste in as text). It does not fetch the web in v1.
- **Latency & cost.** A GenLayer adjudication is minutes‑scale and costs on the
  order of cents per case — fine for real disputes, not for sub‑cent micro‑calls.
- **Correlated‑model risk.** Independent validators reduce single‑model bias, but
  if every validator routes to the same frontier model they can share blind spots
  and injection weaknesses. Keep terms specific and the rubric tight.
- **Not audited.** Reference/educational template; review before mainnet value.

## Extending it (good first forks)

- **Web‑verified deliverables:** add an `evaluate_url` path using GenLayer's web
  access so the committee fetches and judges a live URL (verify the current
  `gl.nondet.web` API against the docs first).
- **x402 glue:** wire `get_settlement` (gated on `final == true`) into an
  ERC‑8183 escrow release.
- **Reputation‑weighted terms:** let a payer require a minimum `get_reputation`
  score before a worker can accept a job.

> Already built in: a one‑time **appeal** (appellate re‑judgement) and an on‑chain
> **worker reputation** scorecard — see the API table above.

---

Built on GenLayer — *the adjudication layer for the agentic economy.*
PRs and forks welcome.
