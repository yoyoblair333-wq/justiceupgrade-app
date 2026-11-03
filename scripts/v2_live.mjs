// Live studionet run for JusticeUpgrade v2 (contracts/justice_upgrade.py).
//
// Deploys v2, then drives one full dispute through the courthouse and records
// every transaction, its consensus status and the contract read-backs:
//
//   bike-1: Ana records a bike-loan agreement with Ben
//           Ana files a dispute with two evidence items: a text statement and
//           a live URL (docs/live/evidence-v2/bike-return-log.md at a pinned
//           commit) that every validator fetches itself during judgment
//           resolve_dispute  -> tier 1 (1 arbiter)
//           Ben appeals      -> tier 2 (3 independent arbiters, strict majority)
//           both parties accept -> FINAL, anonymized precedent recorded
//   inj-1:  a second dispute citing an adversarial page with a hidden
//           "ignore all previous instructions" comment, to show the injection
//           guard on fetched web text
//   transfer_ownership -> Blair's wallet
//
// Keys come from the environment and are never printed (throwaway studionet
// keys in .env.local, funded with the studionet faucet RPC):
//   DEPLOYER_PK, ANA_PK, BEN_PK
// Usage:
//   set -a; . ./.env.local; set +a
//   EVIDENCE_SHA=<commit> node scripts/v2_live.mjs docs/live/v2-studionet-run.json
// Resume: V2_ADDRESS=0x... skips the deploy.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const GL = path.join(ROOT, "frontend/node_modules/genlayer-js/dist");
const { createAccount, createClient } = await import(path.join(GL, "index.js"));
const { studionet } = await import(path.join(GL, "chains/index.js"));

const OUT = process.argv[2] ?? path.join(ROOT, "docs/live/v2-studionet-run.json");
const RPC = "https://studio.genlayer.com/api";
const OWNER = "0x920fbbCf2106B693A857D1995c198e341220a46A";
const REPO = "yoyoblair333-wq/justiceupgrade-app";
const SHA = process.env.EVIDENCE_SHA;
if (!/^[0-9a-f]{40}$/.test(SHA ?? "")) throw new Error("EVIDENCE_SHA (40-hex commit) missing");
const page = (f) => `https://raw.githubusercontent.com/${REPO}/${SHA}/docs/live/evidence-v2/${f}`;

const key = (name) => {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${name} missing`);
  return createAccount(v);
};
const accounts = { deployer: key("DEPLOYER_PK"), ana: key("ANA_PK"), ben: key("BEN_PK") };
const clients = Object.fromEntries(Object.entries(accounts).map(([k, a]) => [k, createClient({ chain: studionet, account: a })]));
const reader = clients.deployer;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = () => new Date().toISOString();
const plain = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x instanceof Map ? Object.fromEntries(x) : x)));
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const canonSha = (text) => createHash("sha256").update(text.replace(/\r\n?/g, "\n").replace(/\n+$/, "") + "\n", "utf8").digest("hex");

const CODE = readFileSync(path.join(ROOT, "contracts/justice_upgrade.py"), "utf8");
const run = {
  network: "studionet", rpc: RPC, startedAt: iso(),
  contract_file: "contracts/justice_upgrade.py", contract_code_sha256: canonSha(CODE),
  final_owner: OWNER, deployer: accounts.deployer.address, party_a_ana: accounts.ana.address, party_b_ben: accounts.ben.address,
  evidence_commit: SHA, contract: process.env.V2_ADDRESS ?? null, steps: [], reads: {},
};
const save = () => writeFileSync(OUT, JSON.stringify(plain(run), null, 1) + "\n");

function summarize(tx) {
  const p = plain(tx) ?? {};
  const votes = p?.consensus_data?.votes ?? {};
  const counts = {};
  for (const v of Object.values(votes)) counts[v] = (counts[v] ?? 0) + 1;
  const lr = Array.isArray(p?.consensus_data?.leader_receipt) ? p.consensus_data.leader_receipt[0] : p?.consensus_data?.leader_receipt;
  const s = JSON.stringify(p);
  return { status: p.statusName ?? null, result: p.resultName ?? null, execution: lr?.execution_result ?? null,
    votes: counts, rounds: p?.num_of_rounds ?? p?.numOfRounds ?? null, error: (s.match(/\[(EXPECTED|ERR[A-Z_]*)\][^"\\]*/) || [null])[0] };
}
async function settle(hash, label, timeoutMs = 1800000) {
  const end = Date.now() + timeoutMs;
  let tx = null, last = "";
  const transitions = [];
  while (Date.now() < end) {
    try { tx = await reader.getTransaction({ hash }); } catch { tx = null; }
    const s = tx?.statusName ?? "";
    if (s && s !== last) { transitions.push({ at: iso(), status: s }); console.log(`  ${label}: ${s}`); last = s; }
    if (["FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(s)) break;
    await sleep(5000);
  }
  return { tx, transitions };
}
async function write(label, functionName, args, as, expect) {
  const step = { label, fn: functionName, as, signer: accounts[as].address, args, expect, sentAt: iso() };
  console.log(`> ${label}`);
  try {
    step.tx = await clients[as].writeContract({ address: run.contract, functionName, args, value: 0n });
    const { tx, transitions } = await settle(step.tx, label);
    step.transitions = transitions;
    step.final = summarize(tx);
  } catch (e) { step.error = String(e?.message ?? e).slice(0, 500); console.log("  error", step.error); }
  run.steps.push(step); save();
  return step;
}
const read = async (fn, args) => {
  try { return plain(await reader.readContract({ address: run.contract, functionName: fn, args })); }
  catch (e) { return { error: String(e?.message ?? e).slice(0, 300) }; }
};

for (const a of Object.values(accounts)) await rpc("sim_fundAccount", [a.address, "0x8ac7230489e80000"]).catch(() => null);

if (!run.contract) {
  console.log("> deploy JusticeUpgrade v2");
  const hash = await clients.deployer.deployContract({ code: CODE, args: [""] });
  const { tx, transitions } = await settle(hash, "deploy");
  run.contract = plain(tx)?.data?.contract_address ?? null;
  run.deploy_tx = hash;
  run.steps.push({ label: "deploy JusticeUpgrade v2", fn: "deploy", as: "deployer", signer: accounts.deployer.address, tx: hash, transitions, final: summarize(tx), address: run.contract });
  save();
  if (!run.contract) throw new Error("deploy failed");
}
const b64 = await rpc("gen_getContractCode", [run.contract]);
run.stored_code_sha256 = canonSha(Buffer.from(b64 ?? "", "base64").toString("utf8"));
run.code_matches = run.stored_code_sha256 === run.contract_code_sha256;
run.reads.config_at_start = await read("get_config", []);
save();
console.log(`contract ${run.contract} code_matches=${run.code_matches}`);
if (!run.code_matches) throw new Error("deployed code hash mismatch");

const TERMS = "Bike loan. Ana (party A) lends Ben (party B) her blue commuter bike on Saturday. " +
  "Ben returns it by Saturday 8pm in the same condition. If anything breaks while Ben has it, " +
  "Ben pays for the repair.";
await write("bike-1 create_agreement (Ana -> Ben)", "create_agreement", ["bike-1", accounts.ben.address, TERMS], "ana", "SUCCESS");
const evidence = JSON.stringify([
  { kind: "text", label: "Ana's statement", content: "The bike came back a day late with a flat rear tyre. The shop charged 14 dollars for a new inner tube." },
  { kind: "url", label: "Return log and repair receipt", content: page("bike-return-log.md") },
]);
await write("bike-1 file_dispute (Ana, text + live URL evidence)", "file_dispute",
  ["bike-1", "Ben returned my bike a day late with a punctured rear tyre and has not paid the 14 dollar repair.", evidence], "ana", "SUCCESS");
run.reads.bike_after_file = await read("get_agreement", ["bike-1"]);
await write("bike-1 resolve_dispute (tier 1: one arbiter)", "resolve_dispute", ["bike-1"], "ana", "RULED");
run.reads.bike_tier1 = await read("get_ruling", ["bike-1"]);
await write("bike-1 appeal by Ben (tier 2: three independent arbiters)", "appeal", ["bike-1"], "ben", "RULED");
run.reads.bike_tier2 = await read("get_ruling", ["bike-1"]);
await write("bike-1 accept_ruling (Ana)", "accept_ruling", ["bike-1"], "ana", "SUCCESS");
await write("bike-1 accept_ruling (Ben) -> FINAL + precedent", "accept_ruling", ["bike-1"], "ben", "FINAL");
run.reads.bike_final = await read("get_agreement", ["bike-1"]);

await write("inj-1 create_agreement", "create_agreement", ["inj-1", accounts.ben.address, TERMS], "ana", "SUCCESS");
await write("inj-1 file_dispute (cites a page with a hidden injection comment)", "file_dispute",
  ["inj-1", "Ben returned the bike late.", JSON.stringify([{ kind: "url", label: "Witness statement", content: page("injected-page.md") }])], "ana", "SUCCESS");
await write("inj-1 resolve_dispute (fetched page carries an injection)", "resolve_dispute", ["inj-1"], "ana", "GUARDED");
run.reads.inj_ruling = await read("get_ruling", ["inj-1"]);

run.reads.precedents = await read("get_precedents", [5n]);
run.reads.precedent_stats = await read("precedent_stats", []);
await write("transfer_ownership -> Blair's wallet", "transfer_ownership", [OWNER], "deployer", "SUCCESS");
run.reads.config_at_end = await read("get_config", []);
run.finishedAt = iso();
save();
console.log("done", run.contract);
