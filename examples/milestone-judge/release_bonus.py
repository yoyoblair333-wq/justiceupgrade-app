# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ReleaseBonus - integration example for MilestoneJudge (cross-contract read).

A sponsor (a DAO, a grant programme, a platform) promises a bonus to every
freelancer whose MilestoneJudge milestone ends RELEASED. This contract does
not judge anything itself: it reads the FINALIZED state of a MilestoneJudge
deployment and pays (here: records) the bonus at most once per milestone.

    claim(engagement_id, index)
        -> reads get_milestone / get_contract on MilestoneJudge (LATEST_FINAL)
        -> requires status FINAL, settlement RELEASED, caller == freelancer
        -> records the bonus once

The same pattern works for an escrow token contract that moves real value
when MilestoneJudge reports RELEASED (amounts there are accounting units).
Lint: genvm-lint check examples/milestone-judge/release_bonus.py
"""

from genlayer import *
from genlayer.py.public_abi import StorageType


class ReleaseBonus(gl.Contract):
    judge: Address
    bonus_units: u256
    final_only: bool                    # read LATEST_FINAL (safe default) or LATEST_NON_FINAL
    claimed: TreeMap[str, str]          # "<engagement>:<index>" -> freelancer hex
    credited: TreeMap[str, u256]        # freelancer hex -> bonus units

    def __init__(self, milestone_judge: str, bonus_units: int, final_only: bool = True):
        self.judge = Address(milestone_judge)
        self.bonus_units = u256(bonus_units)
        self.final_only = bool(final_only)

    @gl.public.write
    def claim(self, engagement_id: int, index: int) -> int:
        judge = gl.get_contract_at(self.judge)
        # Default: read only finalized state, so nothing an appeal could still
        # change is acted on. (On studionet, 2026-11-02, a LATEST_FINAL
        # cross-contract read timed out the leader; final_only=False reads the
        # latest accepted state instead. MilestoneJudge's own FINAL status is
        # already appeal-proof, so this is safe once that tx is finalized.)
        state = StorageType.LATEST_FINAL if self.final_only else StorageType.LATEST_NON_FINAL
        m = judge.view(state=state).get_milestone(engagement_id, index)
        c = judge.view(state=state).get_contract(engagement_id)
        if m["status"] != "FINAL" or m["settlement"] != "RELEASED":
            raise gl.vm.UserError("[EXPECTED] milestone is not released")
        me = gl.message.sender_address.as_hex.lower()
        if me != c["freelancer"]:
            raise gl.vm.UserError("[EXPECTED] only the freelancer may claim")
        key = f"{engagement_id}:{index}"
        if key in self.claimed:
            raise gl.vm.UserError("[EXPECTED] bonus already claimed")
        self.claimed[key] = me
        cur = int(self.credited[me]) if me in self.credited else 0
        self.credited[me] = u256(cur + int(self.bonus_units))
        return int(self.bonus_units)

    @gl.public.view
    def bonus_of(self, freelancer: str) -> int:
        a = Address(freelancer).as_hex.lower()
        return int(self.credited[a]) if a in self.credited else 0
