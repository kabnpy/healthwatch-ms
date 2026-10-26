import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.core.storage import storage
from app.models import (
    DocumentJobPublic,
    DocumentJobResourceType,
    DocumentJobsPublic,
    DocumentJobStatus,
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


@router.get("/{id}/download")
def download_document_job_artifact(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Download the official generated PDF artifact for a completed document job."""
    job = crud.get_document_job(session=session, job_id=id)
    if not job:
        raise HTTPException(status_code=404, detail="Document job not found")

    if job.status != DocumentJobStatus.SUCCEEDED:
        raise HTTPException(
            status_code=400,
            detail=f"Document artifact is not ready for download (status: {job.status.value})",
        )

    file_path_str = job.snapshot_data.get(
        "generated_storage_key"
    ) or job.snapshot_data.get("file_path")
    if not file_path_str:
        raise HTTPException(
            status_code=404,
            detail="Generated document storage reference not found",
        )

    abs_path = storage.get_file_path(file_path_str)
    if not abs_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Generated PDF file not found on disk: {file_path_str}",
        )

    filename = (
        job.snapshot_data.get("filename") or f"{job.resource_type.value}_{job.id}.pdf"
    )
    return FileResponse(
        path=str(abs_path),
        media_type="application/pdf",
        content_disposition_type="attachment",
        filename=filename,
    )


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
