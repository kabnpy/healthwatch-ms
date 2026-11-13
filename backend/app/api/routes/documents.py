import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import SecurityDep, SessionDep, StaffUser
from app.core.storage import storage
from app.models import (
    DocumentCreate,
    DocumentPublic,
    DocumentsPublic,
)
from app.services.document import DocumentNotFoundError, DocumentService

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
        # Save file to storage
        relative_path = storage.save_file(
            file.file,
            filename=file.filename or "unnamed_file",
            folder=entity_type.lower(),
        )

        # Parse metadata
        metadata = {}
        if metadata_json:
            try:
                metadata = json.loads(metadata_json)
            except json.JSONDecodeError:
                pass

        # Create document record
        document_in = DocumentCreate(
            entity_type=entity_type,
            entity_id=entity_id,
            document_type=document_type,
            file_path=relative_path,
            mime_type=file.content_type,
            doc_metadata=metadata,
        )

        return DocumentService.create_document(session=session, document_in=document_in)

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
    document = DocumentService.get_document(session=session, document_id=id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from storage
    storage.delete_file(document.file_path)

    # Delete from DB
    try:
        return DocumentService.delete_document(session=session, document_id=id)
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
    document = DocumentService.get_document(session=session, document_id=id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    absolute_path = storage.get_file_path(document.file_path)
    if not absolute_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Physical file missing from storage: {document.file_path}",
        )

    return FileResponse(
        path=absolute_path,
        media_type=document.mime_type,
        content_disposition_type="inline",
        filename=f"{document.document_type}_{document.id}{Path(document.file_path).suffix}",
    )
