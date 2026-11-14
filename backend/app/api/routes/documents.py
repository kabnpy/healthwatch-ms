import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import SecurityDep, SessionDep, StaffUser
from app.models import (
    DocumentPublic,
    DocumentsPublic,
)
from app.services.document import (
    DocumentConflictError,
    DocumentNotFoundError,
    DocumentService,
    DocumentValidationError,
)

router = APIRouter()


@router.get("/", response_model=DocumentsPublic)
def read_documents(
    session: SessionDep,
    _current_user: SecurityDep,
    skip: int = 0,
    limit: int = 100,
    entity_id: uuid.UUID | None = None,
    entity_type: str | None = None,
) -> Any:
    """
    Retrieve documents.
    """
    documents, count = DocumentService.list_documents(
        session=session,
        skip=skip,
        limit=limit,
        entity_id=entity_id,
        entity_type=entity_type,
    )
    return DocumentsPublic(data=documents, count=count)


@router.post("/upload", response_model=DocumentPublic)
async def upload_document(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: uuid.UUID = Form(...),
    document_type: str = Form(...),
    metadata_json: str = Form(""),
) -> Any:
    """
    Upload a document.
    """
    try:
        return DocumentService.store_document(
            session=session,
            file=file.file,
            filename=file.filename or "unnamed_file",
            entity_type=entity_type,
            entity_id=entity_id,
            document_type=document_type,
            mime_type=file.content_type,
            metadata=metadata_json,
        )
    except DocumentValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to upload document: {str(e)}"
        )


@router.get("/{id}", response_model=DocumentPublic)
def read_document_by_id(
    *,
    session: SessionDep,
    _current_user: SecurityDep,
    id: uuid.UUID,
) -> Any:
    """
    Get document by ID.
    """
    document = DocumentService.get_document(session=session, document_id=id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{id}", response_model=DocumentPublic)
def remove_document(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
) -> Any:
    """
    Delete a document.
    """
    try:
        return DocumentService.remove_document(session=session, document_id=id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DocumentConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/{id}/download")
def download_document(
    *,
    session: SessionDep,
    _current_user: SecurityDep,
    id: uuid.UUID,
) -> Any:
    """
    Download/View a document.
    """
    try:
        artifact = DocumentService.resolve_download(session=session, document_id=id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return FileResponse(
        path=artifact.path,
        media_type=artifact.media_type,
        content_disposition_type="inline",
        filename=artifact.filename,
    )
