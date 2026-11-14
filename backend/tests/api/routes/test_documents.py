import io
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    DocumentEntityType,
    DocumentJobCreate,
    DocumentJobResourceType,
    DocumentJobStatus,
    DocumentType,
)
from app.services.document_job import DocumentJobService


def test_documents_http_routes_lifecycle(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    entity_id = uuid.uuid4()
    upload_res = client.post(
        f"{settings.API_V1_STR}/documents/upload",
        headers=superuser_token_headers,
        data={
            "entity_type": DocumentEntityType.CLIENT.value,
            "entity_id": str(entity_id),
            "document_type": DocumentType.ID.value,
            "metadata_json": '{"source": "route-test"}',
        },
        files={"file": ("id_card.pdf", io.BytesIO(b"%PDF-1.4\n"), "application/pdf")},
    )
    assert upload_res.status_code == 200
    created = upload_res.json()
    doc_id = created["id"]
    assert created["entity_id"] == str(entity_id)
    assert created["doc_metadata"] == {"source": "route-test"}

    list_res = client.get(
        f"{settings.API_V1_STR}/documents/?entity_id={entity_id}",
        headers=superuser_token_headers,
    )
    assert list_res.status_code == 200
    listed = list_res.json()
    assert listed["count"] == 1
    assert listed["data"][0]["id"] == doc_id

    get_res = client.get(
        f"{settings.API_V1_STR}/documents/{doc_id}",
        headers=superuser_token_headers,
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == doc_id

    dl_res = client.get(
        f"{settings.API_V1_STR}/documents/{doc_id}/download",
        headers=superuser_token_headers,
    )
    assert dl_res.status_code == 200
    assert dl_res.content == b"%PDF-1.4\n"

    del_res = client.delete(
        f"{settings.API_V1_STR}/documents/{doc_id}",
        headers=superuser_token_headers,
    )
    assert del_res.status_code == 200

    missing_res = client.get(
        f"{settings.API_V1_STR}/documents/{doc_id}",
        headers=superuser_token_headers,
    )
    assert missing_res.status_code == 404


def test_documents_http_routes_error_mapping(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    entity_id = uuid.uuid4()

    # Invalid metadata_json -> 400 or 422
    bad_upload = client.post(
        f"{settings.API_V1_STR}/documents/upload",
        headers=superuser_token_headers,
        data={
            "entity_type": DocumentEntityType.CLIENT.value,
            "entity_id": str(entity_id),
            "document_type": DocumentType.ID.value,
            "metadata_json": "{not-valid-json",
        },
        files={"file": ("id_card.pdf", io.BytesIO(b"%PDF-1.4\n"), "application/pdf")},
    )
    assert bad_upload.status_code in (400, 422)

    # Document linked to document_job_id -> 409 on DELETE
    job_upload = client.post(
        f"{settings.API_V1_STR}/documents/upload",
        headers=superuser_token_headers,
        data={
            "entity_type": DocumentEntityType.CLIENT.value,
            "entity_id": str(entity_id),
            "document_type": DocumentType.ID.value,
            "metadata_json": f'{{"document_job_id": "{uuid.uuid4()}"}}',
        },
        files={"file": ("job.pdf", io.BytesIO(b"%PDF-1.4\n"), "application/pdf")},
    )
    assert job_upload.status_code == 200
    job_doc_id = job_upload.json()["id"]

    conflict_del = client.delete(
        f"{settings.API_V1_STR}/documents/{job_doc_id}",
        headers=superuser_token_headers,
    )
    assert conflict_del.status_code == 409


def test_document_jobs_http_routes_reads_and_error_mapping(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    job = DocumentJobService.create_job(
        session=db,
        job_in=DocumentJobCreate(
            resource_type=DocumentJobResourceType.STATEMENT,
            idempotency_key=f"route-job-{uuid.uuid4().hex}",
            snapshot_data={"client_name": "Route Test Client"},
        ),
    )
    job.status = DocumentJobStatus.SUCCEEDED
    db.add(job)
    db.commit()

    list_res = client.get(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
    )
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["count"] >= 1
    assert any(item["id"] == str(job.id) for item in body["data"])

    get_res = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job.id}",
        headers=superuser_token_headers,
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == str(job.id)

    conflict_res = client.post(
        f"{settings.API_V1_STR}/document-jobs/{job.id}/process",
        headers=superuser_token_headers,
    )
    assert conflict_res.status_code == 409

    missing_id = uuid.uuid4()
    assert (
        client.get(
            f"{settings.API_V1_STR}/document-jobs/{missing_id}",
            headers=superuser_token_headers,
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{settings.API_V1_STR}/document-jobs/{missing_id}/process",
            headers=superuser_token_headers,
        ).status_code
        == 404
    )
