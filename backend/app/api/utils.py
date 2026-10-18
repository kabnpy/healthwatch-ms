from app.models import Policy, PolicyPublic


def prepare_policy_public(policy: Policy) -> PolicyPublic:
    """
    Populate PolicyPublic with computed data from latest Risk Note.
    """
    from app.models import RiskNoteStatus

    res = PolicyPublic.model_validate(policy)

    # Find the latest ISSUED risk note
    # Relationship is ordered by effective_date desc, created_at desc
    active_rn = next(
        (rn for rn in policy.risk_notes if rn.status == RiskNoteStatus.ISSUED), None
    )

    # If no ISSUED note, take the first one (most recent)
    if not active_rn and policy.risk_notes:
        active_rn = policy.risk_notes[0]

    if active_rn:
        from app.models import RiskNotePublic

        res.active_note = RiskNotePublic.model_validate(active_rn)

    return res
