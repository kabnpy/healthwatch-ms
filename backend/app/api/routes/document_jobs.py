import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    DocumentJobPublic,
    DocumentJobResourceType,
    DocumentJobsPublic,
)
from app.services.document_job import DocumentJobService

router = APIRouter()


class DocumentJobEnqueueRequest(BaseModel):
    resource_type: DocumentJobResourceType
    resource_id: uuid.UUID | None = None
    snapshot_data: dict[str, Any] = {}
    idempotency_key: str | None = None


@router.post(
    "/", response_model=DocumentJobPublic, status_code=status.HTTP_202_ACCEPTED
)
def enqueue_document_job(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    request: DocumentJobEnqueueRequest,
) -> Any:
    """Enqueue an asynchronous document generation job (202 Accepted)."""
    return DocumentJobService.enqueue_job(
        session=session,
        resource_type=request.resource_type,
        resource_id=request.resource_id,
        snapshot_data=request.snapshot_data,
        idempotency_key=request.idempotency_key,
    )


@router.get("/", response_model=DocumentJobsPublic)
def read_document_jobs(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve document generation jobs."""
    jobs = crud.get_document_jobs(session=session, skip=skip, limit=limit)
    return DocumentJobsPublic(data=jobs, count=len(jobs))


@router.get("/{id}", response_model=DocumentJobPublic)
def read_document_job(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Poll document job processing status and retrieve generated artifact storage key."""
    job = crud.get_document_job(session=session, job_id=id)
    if not job:
        raise HTTPException(status_code=404, detail="Document job not found")
    return job


@router.post("/{id}/process", response_model=DocumentJobPublic)
def process_document_job(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
) -> Any:
    """Trigger background worker processing for an enqueued document job."""
    try:
        return DocumentJobService.process_job(session=session, job_id=id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
