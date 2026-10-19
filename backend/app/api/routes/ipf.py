import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    IPFAgreementCreate,
    IPFAgreementPublic,
    IPFAgreementsPublic,
    IPFAgreementUpdate,
    IPFStatus,
)
from app.services.ipf import IPFService

router = APIRouter()


@router.get("/", response_model=IPFAgreementsPublic)
def read_ipf_agreements(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
    policy_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve IPF agreements with optional client or policy filters."""
    agreements = crud.get_ipf_agreements(
        session=session,
        skip=skip,
        limit=limit,
        client_id=client_id,
        policy_id=policy_id,
    )
    count = crud.count_ipf_agreements(
        session=session, client_id=client_id, policy_id=policy_id
    )
    return IPFAgreementsPublic(data=agreements, count=count)


@router.get("/{id}", response_model=IPFAgreementPublic)
def read_ipf_agreement(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single IPF agreement by ID."""
    agreement = crud.get_ipf_agreement(session=session, ipf_id=id)
    if not agreement or agreement.deleted_at is not None:
        raise HTTPException(status_code=404, detail="IPF agreement not found")
    return agreement


@router.post(
    "/", response_model=IPFAgreementPublic, status_code=status.HTTP_201_CREATED
)
def create_ipf_agreement(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    ipf_in: IPFAgreementCreate,
) -> Any:
    """Create a new tripartite Insurance Premium Financing facility."""
    try:
        terms = IPFService.validate_and_calculate_terms(
            total_financed_amount=ipf_in.total_financed_amount,
            deposit_amount=ipf_in.deposit_amount,
            number_of_installments=ipf_in.number_of_installments,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Ensure monthly_installment matches calculated installment
    ipf_in.monthly_installment = terms["monthly_installment"]
    return crud.create_ipf_agreement(session=session, ipf_in=ipf_in)


@router.patch("/{id}", response_model=IPFAgreementPublic)
def update_ipf_agreement(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    ipf_in: IPFAgreementUpdate,
) -> Any:
    """Update IPF status or attach commitment letter document."""
    db_ipf = crud.get_ipf_agreement(session=session, ipf_id=id)
    if not db_ipf or db_ipf.deleted_at is not None:
        raise HTTPException(status_code=404, detail="IPF agreement not found")

    if ipf_in.status is not None and ipf_in.status != db_ipf.status:
        has_doc = bool(
            ipf_in.commitment_letter_document_id or db_ipf.commitment_letter_document_id
        )
        if not IPFService.can_transition(db_ipf.status, ipf_in.status, has_doc):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid IPF status transition from {db_ipf.status.value} to {ipf_in.status.value}"
                + (
                    " (verified commitment letter document required for GUARANTEE)"
                    if ipf_in.status == IPFStatus.GUARANTEED
                    else ""
                ),
            )

    return crud.update_ipf_agreement(session=session, db_ipf=db_ipf, ipf_in=ipf_in)
