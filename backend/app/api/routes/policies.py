import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.api.utils import prepare_policy_public, raise_policy_http_error
from app.models import (
    EndorsementCreate,
    Message,
    PoliciesPublic,
    PolicyCreateExtended,
    PolicyPublic,
    PolicyUpdate,
    RiskNotePublic,
    RiskNotesPublic,
)
from app.schemas import BaseFinancialBreakdown, QuoteRequest, QuoteResponse
from app.services.catalog import CatalogNotFoundError, catalog_service
from app.services.policy import PolicyError, policy_service
from app.services.premium_calculation import RatingValidationError, calculate_premium

router = APIRouter()


@router.get("/", response_model=PoliciesPublic)
def read_policies(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> Any:
    """
    Retrieve policies.
    """
    policies, count = policy_service.list_policies(
        session=session, skip=skip, limit=limit, client_id=client_id
    )
    return PoliciesPublic(
        data=[prepare_policy_public(p) for p in policies], count=count
    )


@router.get("/{id}", response_model=PolicyPublic)
def read_policy(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get policy by ID.
    """
    try:
        policy = policy_service.get_policy(session=session, policy_id=id)
    except PolicyError as exc:
        raise_policy_http_error(exc)
    return prepare_policy_public(policy)


@router.post("/quote", response_model=QuoteResponse)
def get_policy_quote(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    quote_in: QuoteRequest,
) -> Any:
    """
    Get a non-persistent premium quote breakdown.
    """
    try:
        product = catalog_service.get_product_or_raise(
            session=session, product_id=quote_in.product_id
        )
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        result = calculate_premium(
            inputs=quote_in.risk_details,
            product=product,
            session=session,
        )
        breakdown = BaseFinancialBreakdown(
            net_premium=result.net_premium,
            taxes={
                "Training Levy": result.training_levy,
                "PHCF": result.phcf,
                "Stamp Duty": result.stamp_duty,
            },
            commission_amount=result.commission_amount or Decimal("0.00"),
            total_amount=result.total_premium,
        )
        return QuoteResponse(
            breakdown=breakdown,
            calculation_detail=result.calculation_detail,
            rule_provenance=result.rule_provenance,
        )
    except RatingValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=PolicyPublic)
def create_policy(
    *, session: SessionDep, current_user: StaffUser, policy_in: PolicyCreateExtended
) -> Any:
    """
    Create new policy with initial risk note.
    """
    try:
        policy = policy_service.create_policy(
            session=session,
            policy_in=policy_in,
            cover_snapshot=policy_in.risk_details,
            coverage_start=policy_in.coverage_start,
            coverage_end=policy_in.coverage_end,
            current_user_id=current_user.id,
        )
    except PolicyError as exc:
        raise_policy_http_error(exc)
    return prepare_policy_public(policy)


@router.post("/{id}/endorsements", response_model=RiskNotePublic)
def create_endorsement(
    *,
    session: SessionDep,
    current_user: StaffUser,
    id: uuid.UUID,
    endorsement_in: EndorsementCreate,
) -> Any:
    """
    Create a policy endorsement.
    """
    try:
        return policy_service.create_endorsement(
            session=session,
            policy_id=id,
            updated_cover_snapshot=endorsement_in.updated_risk_details,
            change_description=endorsement_in.change_description,
            effective_date=endorsement_in.effective_date,
            current_user_id=current_user.id,
        )
    except PolicyError as exc:
        raise_policy_http_error(exc)


@router.put("/{id}", response_model=PolicyPublic)
def update_policy(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    policy_in: PolicyUpdate,
) -> Any:
    """
    Update a policy container.
    """
    try:
        policy = policy_service.update_policy(
            session=session, policy_id=id, policy_in=policy_in
        )
    except PolicyError as exc:
        raise_policy_http_error(exc)
    return prepare_policy_public(policy)


@router.delete("/{id}", response_model=Message)
def delete_policy(session: SessionDep, _current_user: StaffUser, id: uuid.UUID) -> Any:
    """
    Delete a policy.
    """
    try:
        policy_service.delete_policy(session=session, policy_id=id)
    except PolicyError as exc:
        raise_policy_http_error(exc)
    return Message(message="Policy deleted successfully")


@router.get("/{id}/risk-notes", response_model=RiskNotesPublic)
def read_policy_risk_notes(
    session: SessionDep, _current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Get risk notes for a policy.
    """
    risk_notes, count = policy_service.list_risk_notes(session=session, policy_id=id)
    return RiskNotesPublic(data=risk_notes, count=count)
