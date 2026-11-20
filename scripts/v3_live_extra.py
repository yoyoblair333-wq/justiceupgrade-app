#!/usr/bin/env python3
"""v3_live_extra.py - a clear-cut 'answer decides the case' run on the same v3 contract.

ship-1: Dev claims a paid camera lens never arrived and wants a refund. Cara (the
respondent) answers with the carrier's tracking page (live URL) showing a signed
delivery to Dev. resolve_dispute fetches both sides; every validator re-fetches.

    EVIDENCE_SHA=<commit> python scripts/v3_live_extra.py --contract 0x... [--out ...]
"""
import argparse, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "yoyoblair333-wq/justiceupgrade-app"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--contract", required=True)
    ap.add_argument("--out", default=os.path.join(ROOT, "docs/live/v3-studionet-run-ship.json"))
    a = ap.parse_args(); sha = os.environ["EVIDENCE_SHA"]
    page = f"https://raw.githubusercontent.com/{REPO}/{sha}/docs/live/evidence-v3/carrier-tracking.md"
    acc = {k: create_account() for k in ("cara", "dev")}
    cli = {k: create_client(chain=studionet, account=v) for k, v in acc.items()}
    for k, v in acc.items():
        cli[k].fund_account(v.address, 20 * 10**18)
    run = {"contract": a.contract, "evidence_commit": sha,
           "parties": {"cara_party_a": acc["cara"].address, "dev_party_b": acc["dev"].address}, "steps": []}

    def hx(t):
        h = t.hex() if hasattr(t, "hex") else str(t); return h if h.startswith("0x") else "0x" + h

    def send(who, label, fn, args):
        for _ in range(6):
            try:
                tx = hx(cli[who].write_contract(address=a.contract, function_name=fn, args=args)); break
            except Exception as e:
                print("retry", str(e)[:80], flush=True); time.sleep(15)
        t0 = time.time()
        while True:
            t = cli[who].get_transaction(tx); st = t.get("status_name")
            if st in ("ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT") or time.time() - t0 > 2400:
                break
            time.sleep(10)
        votes = {}
        for v in ((t.get("consensus_data") or {}).get("votes") or {}).values():
            votes[v] = votes.get(v, 0) + 1
        s = json.dumps(t, default=str); i = s.find("[JUSTICE]")
        step = {"step": label, "by": who, "fn": fn, "tx": tx, "status": st, "result": t.get("result_name"),
                "votes": votes, "error": s[i:i + 140].split('"')[0] if i >= 0 else None, "seconds": round(time.time() - t0)}
        run["steps"].append(step); print(json.dumps(step), flush=True)
        json.dump(run, open(a.out, "w"), indent=1, default=str)
        return step

    send("cara", "ship-1: Cara records the sale", "create_agreement", ["ship-1", acc["dev"].address,
         "Cara sells Dev a used 50mm camera lens for 120 GEN, paid up front. Cara ships it to Dev's address, unit 4B, by 2026-11-18."])
    send("dev", "ship-1: Dev files (claims non-delivery)", "file_dispute", ["ship-1",
         "I paid but the lens never arrived. I want a full refund of 120 GEN.", ""])
    send("cara", "ship-1: Cara answers with the carrier tracking page (live URL)", "respond_to_dispute", ["ship-1",
         "The lens was delivered on 2026-11-18 at 11:05 and Dev signed for it. The carrier's tracking record is attached.",
         json.dumps([{"kind": "url", "label": "Carrier tracking JU-88231", "content": page}])])
    for attempt in range(3):
        s = send("dev", f"ship-1: resolve (both sides heard; respondent's URL fetched live) #{attempt + 1}", "resolve_dispute", ["ship-1"])
        if s["status"] in ("ACCEPTED", "FINALIZED") and not s["error"]:
            break
    r = cli["dev"].read_contract(address=a.contract, function_name="get_agreement", args=["ship-1"])
    run["read"] = r; json.dump(run, open(a.out, "w"), indent=1, default=str)
    print("RULING", r["ruling"], r["votes"], r["default_proceeding"], flush=True)


if __name__ == "__main__":
    main()
