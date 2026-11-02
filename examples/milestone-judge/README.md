# MilestoneJudge examples

Files used by the live studionet run (`scripts/milestone_judge_live.mjs`) and an integration
example. Design, consensus and threat model: [`docs/MILESTONE_JUDGE.md`](../../docs/MILESTONE_JUDGE.md).

| File | Role in the live run | Expected result |
|---|---|---|
| [`delivery-ok.md`](delivery-ok.md) | Engagement 1, milestone 1 (quick-start guide) | every criterion MET with on-page quotes: **APPROVED** |
| [`delivery-weak.md`](delivery-weak.md) | Engagement 1, milestone 2, first attempt | criteria NOT_MET: **REVISION_REQUESTED** |
| [`delivery-ok-2.md`](delivery-ok-2.md) | Engagement 1, milestone 2, resubmission | **APPROVED**, then released after the appeal window |
| [`delivery-injected.md`](delivery-injected.md) | Engagement 2, a page that tries to instruct the judge | flag **INJECTED**, every criterion CANNOT_VERIFY, not approved |
| [`release_bonus.py`](release_bonus.py) | Integration: another Intelligent Contract reads MilestoneJudge | pays (records) a bonus once per finalized RELEASED milestone |

The live run submits these pages as **commit-pinned raw URLs**
(`https://raw.githubusercontent.com/yoyoblair333-wq/justiceupgrade-app/<sha>/examples/milestone-judge/<file>`),
so every validator fetches byte-identical content and the stored `content_sha256` can be
re-checked by anyone.

## Try it in GenLayer Studio

1. Open the deployed contract in Studio (the address is in
   [`docs/live/milestone-judge-run.json`](../../docs/live/milestone-judge-run.json)), or deploy
   `contracts/milestone_judge.py` with your own address as `owner`.
2. From account A, call `create_engagement` with account B as the freelancer and this
   `milestones_json`:

   ```json
   [{"title": "Quick-start guide", "amount": 400, "criteria": [
     "Explains how to install the tool with a single command.",
     "Includes a minimal usage example of at least three lines of code.",
     "Lists at least three configuration options with a one-line description each."]}]
   ```

   Use `threshold_pct` 100, `max_attempts` 3, `appeal_window_minutes` 0, `funding_window_hours`
   24 and `delivery_window_hours` 72.
3. From account B, call `accept_engagement(id, terms_sha256)`. Read `terms_sha256` from
   `get_contract(id)`.
4. From account A, call `fund(id)`.
5. From account B, call `submit_delivery(id, 0, "<raw URL of delivery-ok.md>", "")`.
6. Call `get_milestone(id, 0)` to see the labels, the quotes, `content_sha256` and `history`.

## Weighted rubric

The criteria can carry weights and a `required` flag. Set `threshold_pct` below 100 to use them:

```json
[{"title": "Grant report", "amount": 1000, "criteria": [
  {"text": "States the main outcome in the first paragraph.", "weight": 3, "required": true},
  {"text": "Includes at least one chart or table of results.", "weight": 1},
  {"text": "Lists how the funds were spent.", "weight": 2}]}]
```

With `threshold_pct` 60, the milestone is approved if the first criterion is MET and the MET
weight is at least 60 % of 6. `preview_outcome(id, i, labels)` shows the rule's answer for any
set of labels.

## Integration: release_bonus.py

```python
judge = gl.get_contract_at(self.judge)
state = StorageType.LATEST_FINAL if self.final_only else StorageType.LATEST_NON_FINAL
m = judge.view(state=state).get_milestone(engagement_id, index)
if m["status"] != "FINAL" or m["settlement"] != "RELEASED":
    raise gl.vm.UserError("[EXPECTED] milestone is not released")
```

By default it reads only finalized state (`final_only=True`). On studionet a `LATEST_FINAL`
cross-contract read timed out the leader, so the live integration run deployed it with
`final_only=False`. MilestoneJudge's `FINAL` status is terminal anyway. That run claimed the bonus
and the double claim reverted; see `docs/live/milestone-judge-bonus-run.json`. The
same pattern fits a token escrow that moves real value, a reputation or badge contract, or a
next-tranche unlock.
