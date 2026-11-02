"""
Direct-mode tests for A2AEvaluator.

Run from the GenLayer boilerplate root with the dev tooling installed:
    pytest tests/direct/test_a2a_evaluator.py -v

Direct mode runs the contract in-memory and mocks the LLM, so the evaluator's
flow and its bounded-output guarantees can be tested deterministically without a
live network or Studio.
"""

PROMPT = r".*impartial evaluator.*"


def _open_and_submit(contract, vm, payer, worker, terms="Deliver a working REST API with auth.",
                     deliverable="Here is the API: endpoints, auth via JWT, tests passing.",
                     amount="1000", job_id="job-1"):
    vm.sender = payer
    contract.open_job(job_id, str(worker), terms, amount)
    vm.sender = worker
    contract.submit_deliverable(job_id, deliverable)
    return job_id


# ── Happy path: full fulfilment pays the worker the whole escrow ─────────────
# A real ruling is PROVISIONAL (status 'adjudicated', not yet executable); the
# escrow only moves once the appeal window is closed via finalize() (or appeal()).
def test_fulfilled_pays_worker_in_full(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":100,"reasoning":"All terms met."}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)

    prov = contract.get_settlement(job)
    assert prov["ruling"] == "FULFILLED"
    assert prov["status"] == "adjudicated"
    assert prov["final"] is False          # escrow must wait for the appeal window
    assert prov["appealable"] is True

    direct_vm.sender = direct_bob
    contract.finalize(job)
    s = contract.get_settlement(job)
    assert s["status"] == "settled"
    assert s["worker_amount"] == "1000"
    assert s["payer_amount"] == "0"
    assert s["final"] is True
    # Reputation recorded the fulfilled outcome for the worker.
    rep = contract.get_reputation(str(direct_bob))
    assert rep["fulfilled"] == 1
    assert rep["jobs"] == 1


# ── Failure refunds the payer in full ────────────────────────────────────────
def test_not_fulfilled_refunds_payer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"NOT_FULFILLED","worker_share_pct":0,"reasoning":"Core terms unmet."}')
    direct_vm.sender = direct_bob
    contract.evaluate(job)
    direct_vm.sender = direct_alice
    contract.finalize(job)

    s = contract.get_settlement(job)
    assert s["ruling"] == "NOT_FULFILLED"
    assert s["worker_amount"] == "0"
    assert s["payer_amount"] == "1000"
    assert s["final"] is True
    assert contract.get_reputation(str(direct_bob))["not_fulfilled"] == 1


# ── Partial credit splits the escrow on the bounded bucket ───────────────────
def test_partial_splits_escrow(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"PARTIAL","worker_share_pct":75,"reasoning":"Most delivered."}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    direct_vm.sender = direct_alice
    contract.finalize(job)

    s = contract.get_settlement(job)
    assert s["ruling"] == "PARTIAL"
    assert s["worker_share_pct"] == 75
    assert s["worker_amount"] == "750"
    assert s["payer_amount"] == "250"
    assert s["final"] is True
    assert contract.get_reputation(str(direct_bob))["partial"] == 1


# ── Appeal can OVERTURN a provisional ruling (independent re-judgement) ──────
def test_appeal_overturns_ruling(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    # First pass: NOT_FULFILLED (worker gets nothing), provisional.
    direct_vm.mock_llm(PROMPT, '{"ruling":"NOT_FULFILLED","worker_share_pct":0,"reasoning":"Looks unmet."}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    assert contract.get_settlement(job)["status"] == "adjudicated"

    # Worker appeals; the appellate panel finds it FULFILLED and overturns.
    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":100,"reasoning":"Terms actually met."}')
    direct_vm.sender = direct_bob
    contract.appeal(job)

    s = contract.get_settlement(job)
    assert s["ruling"] == "FULFILLED"
    assert s["status"] == "settled"
    assert s["final"] is True
    assert s["appealed"] is True
    assert s["worker_amount"] == "1000"
    # Reputation counted exactly once, on the FINAL (appellate) ruling.
    rep = contract.get_reputation(str(direct_bob))
    assert rep["fulfilled"] == 1
    assert rep["not_fulfilled"] == 0
    assert rep["jobs"] == 1


# ── Appeal UPHOLDS when the panel cannot decide (original ruling stands) ─────
def test_appeal_upholds_when_panel_undecided(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"PARTIAL","worker_share_pct":50,"reasoning":"Half done."}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)

    # Appellate panel returns INSUFFICIENT_EVIDENCE -> the original PARTIAL stands.
    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"Cannot tell."}')
    direct_vm.sender = direct_alice
    contract.appeal(job)

    s = contract.get_settlement(job)
    assert s["ruling"] == "PARTIAL"
    assert s["worker_share_pct"] == 50
    assert s["status"] == "settled"
    assert s["final"] is True


# ── Only one appeal, and not after it is finalized ───────────────────────────
def test_appeal_is_one_shot(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":100,"reasoning":"ok"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    direct_vm.mock_llm(PROMPT, '{"ruling":"PARTIAL","worker_share_pct":50,"reasoning":"on reflection"}')
    direct_vm.sender = direct_alice
    contract.appeal(job)                      # consumes the one appeal -> settled

    # A second appeal is rejected (job is settled, and appeal is one-shot anyway).
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only a provisional (adjudicated) ruling can be appealed"):
        contract.appeal(job)
    # And a settled job cannot be finalized again.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("No provisional ruling to finalize"):
        contract.finalize(job)


# ── A provisional ruling cannot be appealed/finalized by a stranger ──────────
def test_stranger_cannot_appeal_or_finalize(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")
    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":100,"reasoning":"ok"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the payer or worker may appeal"):
        contract.appeal(job)
    with direct_vm.expect_revert("Only the payer or worker may finalize"):
        contract.finalize(job)


# ── A pause must never trap a decided escrow: finalize() stays available ─────
def test_finalize_works_while_paused(direct_vm, direct_deploy, direct_alice, direct_bob):
    # Deploy as alice so she is the owner (and here also the payer).
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/a2a_evaluator.py")
    contract.open_job("job-p", str(direct_bob), "Deliver the thing.", "1000")
    direct_vm.sender = direct_bob
    contract.submit_deliverable("job-p", "Delivered: full thing attached.")
    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":100,"reasoning":"ok"}')
    direct_vm.sender = direct_alice
    contract.evaluate("job-p")                      # -> adjudicated (final False)

    # Owner pauses the evaluator.
    direct_vm.sender = direct_alice
    contract.set_paused(True)

    # appeal() is suspended by the pause (it would run the committee)...
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Evaluator is paused"):
        contract.appeal("job-p")

    # ...but finalize() still works, so the escrow is never trapped.
    direct_vm.sender = direct_bob
    contract.finalize("job-p")
    s = contract.get_settlement("job-p")
    assert s["status"] == "settled"
    assert s["final"] is True
    assert s["worker_amount"] == "1000"


# ── Insufficient evidence settles nothing and allows a resubmit ──────────────
def test_insufficient_allows_resubmit(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob,
                           deliverable="(empty)", amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"Cannot verify."}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)

    s = contract.get_settlement(job)
    assert s["ruling"] == "INSUFFICIENT_EVIDENCE"
    assert s["worker_amount"] == "0"
    assert s["payer_amount"] == "1000"
    assert s["final"] is False            # not an executable settlement
    assert s["status"] == "insufficient"  # worker must resubmit before re-eval

    # Worker resubmits a better deliverable and now passes.
    direct_vm.sender = direct_bob
    contract.submit_deliverable(job, "Now with the full API, auth, and passing tests attached.")
    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":100,"reasoning":"Complete now."}')
    direct_vm.sender = direct_bob
    contract.evaluate(job)
    assert contract.get_settlement(job)["ruling"] == "FULFILLED"


# ── One evaluation per submission: cannot re-roll the model on same evidence ─
def test_cannot_reevaluate_without_resubmitting(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, deliverable="weak", amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"x"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    # Job is now 'insufficient'; evaluating again (same evidence) must be blocked.
    with direct_vm.expect_revert("Nothing submitted to evaluate"):
        contract.evaluate(job)


# ── Exhausting attempts without a decision refunds the payer (executable) ────
def test_exhausted_insufficient_refunds_payer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    contract.open_job("job-ex", str(direct_bob), "Deliver proof of X.", "1000")
    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"nope"}')

    for i in range(3):  # MAX_ATTEMPTS distinct submissions, each undecided
        direct_vm.sender = direct_bob
        contract.submit_deliverable("job-ex", f"attempt {i} evidence")
        direct_vm.sender = direct_alice
        contract.evaluate("job-ex")

    s = contract.get_settlement("job-ex")
    assert s["status"] == "unresolved"
    assert s["ruling"] == "INSUFFICIENT_EVIDENCE"
    assert s["worker_amount"] == "0"
    assert s["payer_amount"] == "1000"
    assert s["final"] is True          # escrow can execute: full refund to payer

    # No further submissions once exhausted.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Job is not awaiting a submission"):
        contract.submit_deliverable("job-ex", "one more try")


# ── Bounded output: out-of-set ruling coerced to the safe default ────────────
def test_out_of_set_ruling_is_coerced(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"MAYBE_OK","worker_share_pct":100,"reasoning":"unsure"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    assert contract.get_settlement(job)["ruling"] == "INSUFFICIENT_EVIDENCE"


# ── Bounded output: an inconsistent ruling/share can never leak a payout ─────
def test_inconsistent_ruling_and_share_is_coerced(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    # "FULFILLED" but only a 50% share -> internally inconsistent -> coerced,
    # so a malformed model answer cannot release funds it did not justify.
    direct_vm.mock_llm(PROMPT, '{"ruling":"FULFILLED","worker_share_pct":50,"reasoning":"half?"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    s = contract.get_settlement(job)
    assert s["ruling"] == "INSUFFICIENT_EVIDENCE"
    assert s["worker_amount"] == "0"


# ── Bounded output: an off-grid share (e.g. 63%) is coerced ──────────────────
def test_off_grid_share_is_coerced(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")

    direct_vm.mock_llm(PROMPT, '{"ruling":"PARTIAL","worker_share_pct":63,"reasoning":"oddly precise"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)
    assert contract.get_settlement(job)["ruling"] == "INSUFFICIENT_EVIDENCE"


# ── Access control ───────────────────────────────────────────────────────────
def test_only_worker_can_submit(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    contract.open_job("job-x", str(direct_bob), "Do the thing.", "500")

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Assigned worker only"):
        contract.submit_deliverable("job-x", "I did it (I am a stranger).")


def test_stranger_cannot_evaluate(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the payer or worker may request evaluation"):
        contract.evaluate(job)


def test_cannot_evaluate_without_submission(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    contract.open_job("job-y", str(direct_bob), "Deliver a design doc.", "500")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Nothing submitted to evaluate"):
        contract.evaluate("job-y")


def test_duplicate_job_id_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    contract.open_job("dup", str(direct_bob), "Terms.", "100")
    with direct_vm.expect_revert("Job id already exists"):
        contract.open_job("dup", str(direct_bob), "Other terms.", "200")


def test_identical_resubmission_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, deliverable="same text")
    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"x"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("This deliverable was already submitted on this job"):
        contract.submit_deliverable(job, "same text")


# ── A non-adjacent re-roll (A -> B -> A) is also rejected ────────────────────
def test_earlier_deliverable_cannot_be_resubmitted(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, deliverable="A", amount="1000")
    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"x"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)                       # A judged INSUFFICIENT

    direct_vm.sender = direct_bob
    contract.submit_deliverable(job, "B")        # different deliverable: allowed
    direct_vm.sender = direct_alice
    contract.evaluate(job)                        # B judged INSUFFICIENT

    # Re-submitting the earlier "A" must be rejected even though it is not the
    # immediately-prior deliverable -- no re-rolling the model on old evidence.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("This deliverable was already submitted on this job"):
        contract.submit_deliverable(job, "A")


# ── Payer can reclaim a stalled escrow (never delivered) ─────────────────────
def test_payer_can_cancel_open_job(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    contract.open_job("job-c", str(direct_bob), "Deliver X.", "1000")

    direct_vm.sender = direct_alice
    contract.cancel_as_payer("job-c")

    s = contract.get_settlement("job-c")
    assert s["status"] == "cancelled"
    assert s["worker_amount"] == "0"
    assert s["payer_amount"] == "1000"
    assert s["final"] is True


# ── Payer can reclaim a stalled escrow (worker stopped resubmitting) ─────────
def test_payer_can_cancel_insufficient_job(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, deliverable="weak", amount="1000")
    direct_vm.mock_llm(PROMPT, '{"ruling":"INSUFFICIENT_EVIDENCE","worker_share_pct":0,"reasoning":"x"}')
    direct_vm.sender = direct_alice
    contract.evaluate(job)                        # status -> insufficient

    direct_vm.sender = direct_alice
    contract.cancel_as_payer(job)
    s = contract.get_settlement(job)
    assert s["status"] == "cancelled"
    assert s["payer_amount"] == "1000"
    assert s["final"] is True

    # Cancelled is terminal: no more submissions or evaluations.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Job is not awaiting a submission"):
        contract.submit_deliverable(job, "late attempt")


# ── A pending (submitted) job cannot be cancelled out from under evaluation ──
def test_cannot_cancel_submitted_job(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    job = _open_and_submit(contract, direct_vm, direct_alice, direct_bob, amount="1000")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only cancel before delivery or while awaiting a resubmission"):
        contract.cancel_as_payer(job)


# ── Only the payer may cancel ────────────────────────────────────────────────
def test_worker_cannot_cancel(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    contract.open_job("job-w", str(direct_bob), "Deliver X.", "1000")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Payer only"):
        contract.cancel_as_payer("job-w")


def test_worker_and_payer_must_differ(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Worker and payer must differ"):
        contract.open_job("self", str(direct_alice), "Pay myself.", "100")


def test_amount_must_be_integer_string(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/a2a_evaluator.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Amount must be a non-negative integer string"):
        contract.open_job("bad-amt", str(direct_bob), "Terms.", "10.5")
