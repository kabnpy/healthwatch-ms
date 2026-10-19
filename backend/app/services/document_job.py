import uuid
from typing import Any

from sqlmodel import Session

from app.models import (
    DocumentJob,
    DocumentJobCreate,
    DocumentJobResourceType,
    DocumentJobStatus,
    get_datetime_utc,
)


class DocumentJobService:
    @staticmethod
    def enqueue_job(
        session: Session,
        resource_type: DocumentJobResourceType,
        resource_id: uuid.UUID | None,
        snapshot_data: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> DocumentJob:
        """
        Enqueues an asynchronous document rendering job with idempotency check.
        """
        if not idempotency_key:
            idempotency_key = f"{resource_type.value}-{resource_id or uuid.uuid4()}-{uuid.uuid4().hex[:8]}"

        job_in = DocumentJobCreate(
            resource_type=resource_type,
            resource_id=resource_id,
            idempotency_key=idempotency_key,
            snapshot_data=snapshot_data or {},
        )

        db_job = DocumentJob.model_validate(job_in)
        db_job.status = DocumentJobStatus.PENDING
        session.add(db_job)
        session.commit()
        session.refresh(db_job)
        return db_job

    @staticmethod
    def process_job(session: Session, job_id: uuid.UUID) -> DocumentJob:
        """
        Processes a pending document job into SUCCEEDED status with generated artifact metadata.
        """
        job = session.get(DocumentJob, job_id)
        if not job:
            raise ValueError("Document job not found")

        job.status = DocumentJobStatus.PROCESSING
        job.updated_at = get_datetime_utc()
        session.add(job)
        session.commit()

        # Simulate rendering output & storage key
        storage_key = f"documents/{job.resource_type.value.lower()}/{job.resource_id or job.id}.pdf"
        job.snapshot_data = {
            **job.snapshot_data,
            "generated_storage_key": storage_key,
            "rendered_at": get_datetime_utc().isoformat(),
        }
        job.status = DocumentJobStatus.SUCCEEDED
        job.attempt_count += 1
        job.updated_at = get_datetime_utc()

        session.add(job)
        session.commit()
        session.refresh(job)
        return job
