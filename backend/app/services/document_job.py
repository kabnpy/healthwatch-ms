import logging
import tempfile
import uuid
from pathlib import Path
from typing import Any

from sqlmodel import Session

from app.core.storage import storage
from app.models import (
    Client,
    Document,
    DocumentEntityType,
    DocumentJob,
    DocumentJobCreate,
    DocumentJobResourceType,
    DocumentJobStatus,
    DocumentType,
    Invoice,
    Policy,
    Product,
    RiskNote,
    get_datetime_utc,
)
from app.services.pdf_renderer import PdfRendererService
from app.services.statement import ClientStatementService

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

    @classmethod
    def render_resource_html(
        cls,
        session: Session,
        resource_type: DocumentJobResourceType,
        resource_id: uuid.UUID | None,
        snapshot_data: dict[str, Any] | None = None,
        job_id: uuid.UUID | None = None,
    ) -> tuple[str, str, DocumentEntityType, uuid.UUID | None, str, list[str]]:
        """
        Renders HTML content and returns (rendered_html, filename, entity_type, entity_id, fallback_title, fallback_lines).
        """
        snapshot = snapshot_data or {}
        target_id = resource_id
        ref_id = job_id or uuid.uuid4()

        filename = f"Document_{resource_type.value}_{ref_id}.pdf"
        entity_type = DocumentEntityType.CLIENT
        entity_id = target_id or ref_id
        fallback_title = f"{resource_type.value.replace('_', ' ').title()}"
        fallback_lines: list[str] = [
            f"Resource Type: {resource_type.value}",
            f"Resource ID: {resource_id}",
            f"Rendered At: {get_datetime_utc().isoformat()}",
        ]

        if resource_type == DocumentJobResourceType.RISK_NOTE:
            risk_note = session.get(RiskNote, target_id) if target_id else None
            if risk_note:
                policy = (
                    session.get(Policy, risk_note.policy_id)
                    if risk_note.policy_id
                    else None
                )
                client = (
                    session.get(Client, policy.client_id)
                    if policy and policy.client_id
                    else None
                )
                product = (
                    session.get(Product, policy.product_id)
                    if policy and policy.product_id
                    else None
                )
                insurer = getattr(product, "insurer", None)

                include_digital_stamp = bool(
                    snapshot.get("include_digital_stamp", True)
                )

                # Multi-vehicle & single vehicle resolution
                vehicles: list[Any] = []
                if policy and hasattr(policy, "vehicles") and policy.vehicles:
                    vehicles = list(policy.vehicles)
                elif risk_note.cover_snapshot:
                    snap = risk_note.cover_snapshot
                    if "vehicles" in snap and isinstance(snap["vehicles"], list):
                        vehicles = snap["vehicles"]
                    elif "vehicle" in snap:
                        vehicles = [snap["vehicle"]]
                    elif "VEHICLE DETAILS" in snap:
                        vehicles = [snap["VEHICLE DETAILS"]]

                vehicle = vehicles[0] if vehicles else None

                # Financial breakdown resolution
                breakdown = risk_note.financial_breakdown or {}
                taxes = breakdown.get("taxes", {})
                benefits = breakdown.get("benefits", [])

                cov_start_str = (
                    risk_note.coverage_start.strftime("%d %B %Y")
                    if hasattr(risk_note.coverage_start, "strftime")
                    else str(risk_note.coverage_start)
                )
                cov_end_str = (
                    risk_note.coverage_end.strftime("%d %B %Y")
                    if hasattr(risk_note.coverage_end, "strftime")
                    else str(risk_note.coverage_end)
                )
                stamp_dt = get_datetime_utc().strftime("%d %b %Y").upper()

                rendered_html = PdfRendererService.render_html(
                    "risk_note.html",
                    {
                        "risk_note": risk_note,
                        "policy": policy,
                        "client": client,
                        "product": product,
                        "insurer": insurer,
                        "vehicle": vehicle,
                        "vehicles": vehicles,
                        "taxes": taxes,
                        "benefits": benefits,
                        "coverage_start_formatted": cov_start_str,
                        "coverage_end_formatted": cov_end_str,
                        "stamp_date": stamp_dt,
                        "include_digital_stamp": include_digital_stamp,
                        "generated_at": get_datetime_utc().strftime(
                            "%Y-%m-%d %H:%M:%S UTC"
                        ),
                    },
                )
                filename = f"RiskNote_{risk_note.risk_note_number or risk_note.id}.pdf"
                entity_type = DocumentEntityType.RISK_NOTE
                entity_id = risk_note.id
                fallback_title = (
                    f"Risk Note {risk_note.risk_note_number or risk_note.id}"
                )
                fallback_lines.extend(
                    [
                        f"Policy Number: {policy.policy_number if policy else 'N/A'}",
                        f"Client: {client.name if client else 'N/A'}",
                        f"Net Premium: KES {risk_note.net_premium}",
                    ]
                )
            else:
                rendered_html = f"<!DOCTYPE html><html><body><h1>Risk Note</h1><p>ID: {target_id or ref_id}</p></body></html>"

        elif resource_type == DocumentJobResourceType.INVOICE:
            invoice = session.get(Invoice, target_id) if target_id else None
            if invoice:
                client = (
                    session.get(Client, invoice.client_id)
                    if invoice.client_id
                    else None
                )
                policy = None
                if hasattr(invoice, "line_items") and invoice.line_items:
                    first_item = invoice.line_items[0]
                    if (
                        hasattr(first_item, "risk_note")
                        and first_item.risk_note
                        and hasattr(first_item.risk_note, "policy")
                    ):
                        policy = first_item.risk_note.policy

                inv_date_str = (
                    invoice.date_issued.strftime("%d %B %Y")
                    if hasattr(invoice.date_issued, "strftime")
                    else str(invoice.date_issued)
                )
                due_date_str = (
                    invoice.due_date.strftime("%d %B %Y")
                    if hasattr(invoice.due_date, "strftime")
                    else str(invoice.due_date)
                )

                rendered_html = PdfRendererService.render_html(
                    "invoice.html",
                    {
                        "invoice": invoice,
                        "client": client,
                        "policy": policy,
                        "invoice_date_formatted": inv_date_str,
                        "due_date_formatted": due_date_str,
                        "generated_at": get_datetime_utc().strftime(
                            "%Y-%m-%d %H:%M:%S UTC"
                        ),
                    },
                )
                filename = f"Invoice_{invoice.invoice_number or invoice.id}.pdf"
                entity_type = DocumentEntityType.CLIENT
                entity_id = invoice.client_id or invoice.id
                fallback_title = f"Invoice {invoice.invoice_number or invoice.id}"
                fallback_lines.extend(
                    [
                        f"Client: {client.name if client else 'N/A'}",
                        f"Invoice Amount: KES {invoice.total_amount}",
                        f"Status: {invoice.status.value}",
                    ]
                )
            else:
                rendered_html = f"<!DOCTYPE html><html><body><h1>Invoice</h1><p>ID: {target_id or ref_id}</p></body></html>"

        elif resource_type == DocumentJobResourceType.STATEMENT:
            raw_client_id = (
                target_id or snapshot.get("client_id") or snapshot.get("resource_id")
            )
            client_uuid: uuid.UUID | None = None
            if raw_client_id:
                try:
                    client_uuid = uuid.UUID(str(raw_client_id))
                except ValueError:
                    client_uuid = None

            client = session.get(Client, client_uuid) if client_uuid else None
            if client:
                statement_data = ClientStatementService.generate_statement(
                    session, client.id
                )
                client_name = client.name
                client_id_val = client.id
            else:
                client_name = snapshot.get("client_name", "Valued Client")
                client_id_val = client_uuid or ref_id
                statement_data = {
                    "client_id": str(client_id_val),
                    "client_name": client_name,
                    "kra_pin": snapshot.get("kra_pin", "NOT SPECIFIED"),
                    "total_invoiced": str(snapshot.get("total_invoiced", "0.00")),
                    "total_allocated": str(snapshot.get("total_allocated", "0.00")),
                    "net_outstanding_balance": str(
                        snapshot.get("net_outstanding_balance", "0.00")
                    ),
                    "invoice_count": int(snapshot.get("invoice_count", 0)),
                    "allocation_count": int(snapshot.get("allocation_count", 0)),
                    "ledger_entries": snapshot.get("ledger_entries", []),
                }

            rendered_html = PdfRendererService.render_html(
                "statement.html",
                {
                    "statement": statement_data,
                    "generated_at": get_datetime_utc().strftime(
                        "%Y-%m-%d %H:%M:%S UTC"
                    ),
                },
            )
            client_slug = client_name.replace(" ", "_")
            filename = f"Statement_{client_slug}_{client_id_val}.pdf"
            entity_type = DocumentEntityType.CLIENT
            entity_id = client_id_val
            fallback_title = f"Statement - {client_name}"
            fallback_lines.extend(
                [
                    f"Client Name: {client_name}",
                    f"Outstanding Balance: KES {statement_data.get('net_outstanding_balance')}",
                    f"Invoices: {statement_data.get('invoice_count')}",
                ]
            )

        else:
            fallback_title = f"Document {resource_type.value}"
            rendered_html = f"<!DOCTYPE html><html><body><h1>{fallback_title}</h1><p>Rendered via HealthWatch MS document pipeline.</p></body></html>"

        return (
            rendered_html,
            filename,
            entity_type,
            entity_id,
            fallback_title,
            fallback_lines,
        )

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
            (
                rendered_html,
                filename,
                entity_type,
                entity_id,
                fallback_title,
                fallback_lines,
            ) = cls.render_resource_html(
                session=session,
                resource_type=job.resource_type,
                resource_id=job.resource_id,
                snapshot_data=job.snapshot_data,
                job_id=job.id,
            )

            # Render PDF to temporary file
            with tempfile.NamedTemporaryFile(
                "wb", suffix=".pdf", delete=False
            ) as tmp_out:
                tmp_out_path = Path(tmp_out.name)

            try:
                PdfRendererService.render_pdf(
                    html_content=rendered_html,
                    output_path=tmp_out_path,
                    fallback_title=fallback_title,
                    fallback_lines=fallback_lines,
                )

                # Save generated PDF into persistent storage
                with tmp_out_path.open("rb") as pdf_file:
                    saved_path = storage.save_file(
                        file=pdf_file,
                        filename=filename,
                        folder=f"documents/{job.resource_type.value.lower()}",
                    )
            finally:
                if tmp_out_path.exists():
                    tmp_out_path.unlink()

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

            # Mark job succeeded
            job.status = DocumentJobStatus.SUCCEEDED
            job.attempt_count += 1
            job.updated_at = get_datetime_utc()
            job.error_message = None
            job.snapshot_data = {
                **(job.snapshot_data or {}),
                "generated_storage_key": saved_path,
                "file_path": saved_path,
                "filename": filename,
                "document_id": str(doc.id),
                "rendered_at": get_datetime_utc().isoformat(),
            }
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
