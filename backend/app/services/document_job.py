import io
import logging
import uuid
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.core.db import engine
from app.core.storage import storage
from app.models import (
    Document,
    DocumentJob,
    DocumentJobCreate,
    DocumentJobResourceType,
    DocumentJobStatus,
    DocumentType,
    get_datetime_utc,
)
from app.services.document_renderer import DocumentRenderer

logger = logging.getLogger(__name__)


class DocumentJobService:
    @staticmethod
    def enqueue_job(
        session: Session,
        resource_type: DocumentJobResourceType,
        resource_id: uuid.UUID | None = None,
        snapshot_data: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> DocumentJob:
        """
        Enqueues an asynchronous document rendering job with idempotency check.
        """
        frozen_snapshot = DocumentRenderer.build_snapshot(
            session=session,
            resource_type=resource_type,
            resource_id=resource_id,
            snapshot_override=snapshot_data,
        )

        if idempotency_key:
            existing = session.exec(
                select(DocumentJob).where(
                    DocumentJob.idempotency_key == idempotency_key
                )
            ).first()
            if existing is not None:
                if existing.status in {
                    DocumentJobStatus.PENDING,
                    DocumentJobStatus.PROCESSING,
                    DocumentJobStatus.SUCCEEDED,
                }:
                    return existing
                existing.status = DocumentJobStatus.PENDING
                existing.snapshot_data = frozen_snapshot
                existing.error_code = None
                existing.error_message = None
                existing.updated_at = get_datetime_utc()
                session.add(existing)
                session.commit()
                session.refresh(existing)
                return existing
        else:
            idempotency_key = f"{resource_type.value}-{resource_id or uuid.uuid4()}-{uuid.uuid4().hex[:8]}"

        job_in = DocumentJobCreate(
            resource_type=resource_type,
            resource_id=resource_id,
            idempotency_key=idempotency_key,
            snapshot_data=frozen_snapshot,
        )

        db_job = DocumentJob.model_validate(job_in)
        db_job.status = DocumentJobStatus.PENDING
        session.add(db_job)
        session.commit()
        session.refresh(db_job)
        return db_job

    @classmethod
    def process_job_in_background(cls, job_id: uuid.UUID) -> None:
        """Process a document job in a fresh DB session for FastAPI BackgroundTasks."""
        with Session(engine) as session:
            try:
                cls.process_job(session=session, job_id=job_id)
            except Exception:
                logger.exception("Background processing failed for document job %s", job_id)

    @classmethod
    def process_job(cls, session: Session, job_id: uuid.UUID) -> DocumentJob:
        """
        Processes a pending document job into SUCCEEDED status with generated PDF artifact.
        """
        job = session.get(DocumentJob, job_id)
        if not job:
            raise ValueError("Document job not found")

        job.status = DocumentJobStatus.PROCESSING
        job.updated_at = get_datetime_utc()
        session.add(job)
        session.commit()

        try:
            rendered = DocumentRenderer.render_pdf(
                session=session,
                resource_type=job.resource_type,
                resource_id=job.resource_id,
                snapshot_override=job.snapshot_data,
                job_id=job.id,
            )
            filename = rendered.filename
            entity_type = rendered.entity_type
            entity_id = rendered.entity_id

            if not rendered.pdf_bytes:
                raise ValueError("DocumentRenderer did not produce PDF bytes")

            saved_path = storage.save_file(
                file=io.BytesIO(rendered.pdf_bytes),
                filename=filename,
                folder=f"documents/{job.resource_type.value.lower()}",
            )

            # Record generated artifact in Document table
            doc = Document(
                entity_type=entity_type,
                entity_id=entity_id,
                document_type=DocumentType.OTHER,
                file_path=saved_path,
                mime_type="application/pdf",
                doc_metadata={
                    "document_job_id": str(job.id),
                    "resource_type": job.resource_type.value,
                    "filename": filename,
                    "pipeline": "playwright_headless",
                },
            )
            session.add(doc)
            session.commit()
            session.refresh(doc)

            # Mark job succeeded and link persisted Document without mutating snapshot_data
            job.status = DocumentJobStatus.SUCCEEDED
            job.document_id = doc.id
            job.attempt_count += 1
            job.updated_at = get_datetime_utc()
            job.error_message = None
            session.add(job)
            session.commit()
            session.refresh(job)
            return job

        except Exception as e:
            logger.exception("Failed to process document job %s: %s", job_id, e)
            job.status = DocumentJobStatus.FAILED
            job.attempt_count += 1
            job.error_message = str(e)
            job.updated_at = get_datetime_utc()
            session.add(job)
            session.commit()
            session.refresh(job)
            raise

    @staticmethod
    def resolve_download_artifact(
        session: Session, job_id: uuid.UUID
    ) -> tuple[Path, str]:
        """Resolve the persisted PDF file path and download filename for a completed job."""
        job = session.get(DocumentJob, job_id)
        if not job:
            raise LookupError("Document job not found")

        if job.status != DocumentJobStatus.SUCCEEDED:
            raise ValueError(
                f"Document artifact is not ready for download (status: {job.status.value})"
            )

        if not job.document_id:
            raise LookupError("Generated document reference not found")

        doc = session.get(Document, job.document_id)
        if not doc or not doc.file_path:
            raise LookupError("Generated document storage reference not found")

        abs_path = storage.get_file_path(doc.file_path)
        if not abs_path.exists():
            raise LookupError(f"Generated PDF file not found on disk: {doc.file_path}")

        filename = (doc.doc_metadata or {}).get(
            "filename"
        ) or f"{job.resource_type.value}_{job.id}.pdf"
        return abs_path, filename
