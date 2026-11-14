import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    DocumentJobPublic,
    DocumentJobResourceType,
    DocumentJobsPublic,
    DocumentJobStatus,
)
from app.services.document_job import (
    DocumentJobConflictError,
    DocumentJobNotFoundError,
    DocumentJobService,
)
from app.services.document_renderer import DocumentRenderer

router = APIRouter()


class DocumentJobEnqueueRequest(BaseModel):
    resource_type: DocumentJobResourceType
    resource_id: uuid.UUID | None = None
    snapshot_data: dict[str, Any] = {}
    idempotency_key: str | None = None


class DocumentPreviewDraftRequest(BaseModel):
    resource_type: DocumentJobResourceType
    resource_id: uuid.UUID | None = None
    snapshot_data: dict[str, Any] = {}


@router.post(
    "/", response_model=DocumentJobPublic, status_code=status.HTTP_202_ACCEPTED
)
def enqueue_document_job(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    request: DocumentJobEnqueueRequest,
    background_tasks: BackgroundTasks,
    idempotency_key_header: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    """Enqueue an asynchronous document generation job (202 Accepted)."""
    job = DocumentJobService.enqueue_job(
        session=session,
        resource_type=request.resource_type,
        resource_id=request.resource_id,
        snapshot_data=request.snapshot_data,
        idempotency_key=idempotency_key_header or request.idempotency_key,
    )
    if job.status == DocumentJobStatus.PENDING:
        background_tasks.add_task(
            DocumentJobService.process_job_in_background, job.id
        )
    return job


@router.get("/", response_model=DocumentJobsPublic)
def read_document_jobs(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve document generation jobs."""
    jobs, count = DocumentJobService.list_jobs(session=session, skip=skip, limit=limit)
    return DocumentJobsPublic(data=jobs, count=count)


@router.get("/preview/html", response_class=HTMLResponse)
def preview_document_html(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    resource_type: DocumentJobResourceType,
    resource_id: uuid.UUID | None = None,
) -> Any:
    """Renders the canonical Jinja2 document HTML for instant browser preview with 100% print fidelity."""
    snapshot = DocumentRenderer.build_snapshot(
        session=session,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    rendered = DocumentRenderer.render_html(
        snapshot,
        resource_type=resource_type,
    )
    return HTMLResponse(content=rendered.html)


@router.post("/preview/html", response_class=HTMLResponse)
def preview_document_html_draft(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    request: DocumentPreviewDraftRequest,
) -> Any:
    """Renders the canonical Jinja2 document HTML with live draft snapshot overrides."""
    snapshot = DocumentRenderer.build_snapshot(
        session=session,
        resource_type=request.resource_type,
        resource_id=request.resource_id,
        snapshot_override=request.snapshot_data,
    )
    rendered = DocumentRenderer.render_html(
        snapshot,
        resource_type=request.resource_type,
    )
    return HTMLResponse(content=rendered.html)


@router.get("/{id}", response_model=DocumentJobPublic)
def read_document_job(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Poll document job processing status and retrieve generated artifact storage key."""
    job = DocumentJobService.get_job(session=session, job_id=id)
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
    try:
        abs_path, filename = DocumentJobService.resolve_download_artifact(
            session=session, job_id=id
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    """Trigger staff retry processing for a FAILED or stuck PENDING document job."""
    try:
        return DocumentJobService.retry_job(session=session, job_id=id)
    except DocumentJobNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DocumentJobConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
