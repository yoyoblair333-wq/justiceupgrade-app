#!/usr/bin/env python3
"""
v3_live.py - live studionet run for JusticeUpgrade v3 (both sides heard).

    EVIDENCE_SHA=<commit> python scripts/v3_live.py [--contract 0x...] [--out docs/live/v3-studionet-run.json]

laptop-1: Ana sells Ben a laptop. Ben files a dispute citing his battery test (live URL).
          Ana ANSWERS with her pre-shipment test (live URL). resolve_dispute: the
          contract fetches BOTH pages and every validator re-fetches both.
          Ana then offers a SPLIT settlement and Ben accepts: closed as settled,
          no model call, anonymized "settled" precedent.
default-1: Ben files; Ana never answers. resolve is refused while the window is
          open, then runs as a DEFAULT PROCEEDING after it closes.
Ownership is transferred to Blair's wallet at the end.

Throwaway studionet keys are created in memory and funded with sim_fundAccount.
Every transaction is recorded with its consensus status; nothing is faked.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time

from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet
from genlayer_py.types import TransactionStatus as S

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "yoyoblair333-wq/justiceupgrade-app"
OWNER = "0x920fbbCf2106B693A857D1995c198e341220a46A"
WINDOW = 300
WEI = 10**18


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--contract")
    ap.add_argument("--out", default=os.path.join(ROOT, "docs/live/v3-studionet-run.json"))
    a = ap.parse_args()
    sha = os.environ.get("EVIDENCE_SHA", "")
    assert len(sha) == 40, "EVIDENCE_SHA missing"
    page = lambda f: f"https://raw.githubusercontent.com/{REPO}/{sha}/docs/live/evidence-v3/{f}"

    acc = {k: create_account() for k in ("deployer", "ana", "ben")}
    cli = {k: create_client(chain=studionet, account=v) for k, v in acc.items()}
    for k, v in acc.items():
        cli[k].fund_account(v.address, 50 * WEI)
    code = open(os.path.join(ROOT, "contracts/justice_upgrade.py"), encoding="utf-8").read()
    run = {"network": "studionet (chain 61999)", "schema": "justiceupgrade.court.v3",
           "contract_code_sha256": hashlib.sha256(code.encode()).hexdigest(),
           "evidence_commit": sha, "response_window_seconds": WINDOW,
           "parties": {"ana_party_a": acc["ana"].address, "ben_party_b": acc["ben"].address},
           "steps": [], "reads": {}}

    def save():
        with open(a.out, "w", encoding="utf-8") as fh:
            json.dump(run, fh, indent=1, default=str)

    def hx(t):
        h = t.hex() if hasattr(t, "hex") else str(t)
        return h if h.startswith("0x") else "0x" + h

    def send(who, label, fn, args, expect_ok=True):
        for i in range(6):
            try:
                tx = hx(cli[who].write_contract(address=run["contract"], function_name=fn, args=args))
                break
            except Exception as e:
                print(f"  submit retry {label}: {str(e)[:90]}", flush=True)
                time.sleep(15)
        return wait(tx, label, who, fn)

    def wait(tx, label, who="", fn=""):
        t0 = time.time()
        while True:
            try:
                t = cli["deployer"].get_transaction(tx)
                st = t.get("status_name")
                if st in ("ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"):
                    break
            except Exception as e:
                print(f"  poll error {str(e)[:80]}", flush=True)
            if time.time() - t0 > 2400:
                st = "TIMEOUT_LOCAL"
                t = {}
                break
            time.sleep(10)
        votes = {}
        for v in ((t.get("consensus_data") or {}).get("votes") or {}).values():
            votes[v] = votes.get(v, 0) + 1
        s = json.dumps(t, default=str)
        err = None
        for tag in ("[JUSTICE]", "[REJECTED]", "[LLM_ERROR]"):
            i = s.find(tag)
            if i >= 0:
                err = s[i:i + 160].split('"')[0]
                break
        step = {"step": label, "by": who, "fn": fn, "tx": tx, "status": st,
                "result": t.get("result_name"), "votes": votes, "error": err,
                "seconds": round(time.time() - t0)}
        run["steps"].append(step)
        print(json.dumps(step), flush=True)
        save()
        return step

    def read(fn, args):
        return cli["deployer"].read_contract(address=run["contract"], function_name=fn, args=args)

    if a.contract:
        run["contract"] = a.contract
    else:
        tx = hx(cli["deployer"].deploy_contract(code=code, args=["", WINDOW]))
        r = cli["deployer"].wait_for_transaction_receipt(transaction_hash=tx, status=S.ACCEPTED, interval=10000, retries=240)
        run["contract"] = (r.get("data") or {}).get("contract_address") or (r.get("tx_data_decoded") or {}).get("contract_address")
        wait(tx, "deploy v3 (response window 300 s)", "deployer", "deploy")
    print("contract", run["contract"], flush=True)
    run["explorer"] = f"https://explorer-studio.genlayer.com/address/{run['contract']}"
    run["studio"] = f"https://studio.genlayer.com/?import-contract={run['contract']}"

    terms = ("Ana sells Ben her used laptop (serial ending 4417) for 400 GEN. The listing says the "
             "battery holds about 3 hours of light use. Ana ships by 2026-11-19.")
    send("ana", "laptop-1: Ana records the agreement", "create_agreement", ["laptop-1", acc["ben"].address, terms])
    send("ben", "laptop-1: Ben files with his battery test (live URL)", "file_dispute", [
        "laptop-1", "The battery died in 42 minutes, nowhere near the 3 hours promised. I want a partial refund.",
        json.dumps([{"kind": "url", "label": "Buyer battery test", "content": page("buyer-battery-test.md")}])])
    s = send("ben", "laptop-1: resolve BEFORE Ana answers (refused: window open)", "resolve_dispute", ["laptop-1"])
    send("ana", "laptop-1: Ana answers with her pre-shipment test (live URL)", "respond_to_dispute", [
        "laptop-1", "The listing promised about 3 hours of LIGHT use. My test before shipping gave 3h10m. "
        "Ben tested heavy browsing at 50% brightness, which drains faster.",
        json.dumps([{"kind": "url", "label": "Seller pre-shipment test", "content": page("seller-pre-shipment-test.md")},
                    {"kind": "text", "label": "Listing wording", "content": "Battery holds about 3 hours of light use."}])])
    send("ben", "laptop-1: resolve (both sides heard; both URLs fetched live)", "resolve_dispute", ["laptop-1"])
    run["reads"]["laptop-1 after ruling"] = read("get_agreement", ["laptop-1"])
    send("ana", "laptop-1: Ana offers a SPLIT settlement", "propose_settlement",
         ["laptop-1", "SPLIT", "Ana refunds 80 GEN toward a replacement battery; Ben keeps the laptop."])
    send("ben", "laptop-1: Ben accepts the settlement (no model call)", "accept_settlement", ["laptop-1"])
    run["reads"]["laptop-1 settled"] = read("get_agreement", ["laptop-1"])

    send("ana", "default-1: Ana records a second agreement", "create_agreement", ["default-1", acc["ben"].address,
         "Ana delivers 10 hand-drawn icons to Ben by 2026-11-19 for 50 GEN."])
    send("ben", "default-1: Ben files; Ana does not answer", "file_dispute",
         ["default-1", "Only 6 of the 10 icons were delivered.",
          json.dumps([{"kind": "text", "label": "Delivery count", "content": "Folder received on 2026-11-19 holds 6 icon files."}])])
    filed = time.time()
    while time.time() - filed < WINDOW + 30:
        time.sleep(15)
    send("ben", "default-1: resolve after the window closed (DEFAULT PROCEEDING)", "resolve_dispute", ["default-1"])
    run["reads"]["default-1 after ruling"] = read("get_agreement", ["default-1"])
    run["reads"]["precedents"] = read("get_precedents", [10])
    run["reads"]["precedent_stats"] = read("precedent_stats", [])
    send("deployer", "transfer ownership to Blair's wallet", "transfer_ownership", [OWNER])
    run["reads"]["config"] = read("get_config", [])
    save()
    print("done", flush=True)


if __name__ == "__main__":
    main()
