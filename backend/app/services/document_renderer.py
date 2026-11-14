import logging
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, replace
from decimal import Decimal
from pathlib import Path
from typing import Any, Protocol

import jinja2
from fastapi.encoders import jsonable_encoder
from markdown_it import MarkdownIt
from pydantic import ValidationError
from sqlmodel import Session

from app.models import (
    Client,
    DocumentEntityType,
    DocumentJobResourceType,
    Invoice,
    Policy,
    Product,
    RiskNote,
    get_datetime_utc,
)
from app.schemas import MotorPrivateRiskDetails
from app.services.client_ledger import ClientLedgerService

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "documents"
FRONTEND_RENDER_SCRIPT = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "frontend"
    / "scripts"
    / "render_pdf.ts"
)

_md_parser = MarkdownIt()


def render_markdown(val: Any) -> str:
    """Renders markdown strings into HTML for policy schedules and endorsement clauses."""
    if not val:
        return ""
    return _md_parser.render(str(val))


def format_kes(val: Any) -> str:
    """Format numeric/decimal values as Kenyan Shillings with comma separators and 2 decimal places."""
    if val is None or val == "":
        return "0.00"
    try:
        d = Decimal(str(val))
        return f"{d:,.2f}"
    except Exception:
        return str(val)


@dataclass(frozen=True)
class RenderedDocument:
    """Immutable rendered HTML/PDF output and metadata for a domain document."""

    html: str
    filename: str
    entity_type: DocumentEntityType
    entity_id: uuid.UUID | None
    fallback_title: str
    fallback_lines: list[str]
    pdf_bytes: bytes | None = None


class PdfRasterizer(Protocol):
    """Adapter seam for rasterizing HTML into PDF bytes."""

    def render(self, html_content: str) -> bytes: ...


class PlaywrightPdfRasterizer:
    """Production PDF rasterizer backed by Bun and Playwright."""

    def render(self, html_content: str) -> bytes:
        bun_bin = shutil.which("bun")
        if not bun_bin:
            raise RuntimeError("Bun runtime not found for PDF rasterization")
        if not FRONTEND_RENDER_SCRIPT.exists():
            raise RuntimeError(
                f"Playwright render script not found: {FRONTEND_RENDER_SCRIPT}"
            )

        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as tmp_html:
            tmp_html.write(html_content)
            tmp_html_path = Path(tmp_html.name)

        with tempfile.NamedTemporaryFile("wb", suffix=".pdf", delete=False) as tmp_pdf:
            tmp_pdf_path = Path(tmp_pdf.name)

        try:
            cmd = [
                bun_bin,
                "run",
                str(FRONTEND_RENDER_SCRIPT),
                "--input",
                str(tmp_html_path),
                "--output",
                str(tmp_pdf_path),
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            if result.returncode != 0:
                stderr = (result.stderr or "").strip()
                raise RuntimeError(
                    f"Bun Playwright rendering failed (code {result.returncode}): {stderr}"
                )
            if not tmp_pdf_path.exists() or tmp_pdf_path.stat().st_size == 0:
                raise RuntimeError("Bun Playwright produced an empty PDF output")
            logger.info("PDF successfully rendered via Bun Playwright")
            return tmp_pdf_path.read_bytes()
        finally:
            if tmp_html_path.exists():
                tmp_html_path.unlink()
            if tmp_pdf_path.exists():
                tmp_pdf_path.unlink()


class DocumentRenderer:
    """Loads domain resources, normalizes snapshots, and renders Jinja2 HTML."""

    _jinja_env: jinja2.Environment | None = None
    pdf_rasterizer: PdfRasterizer = PlaywrightPdfRasterizer()

    @classmethod
    def get_jinja_env(cls) -> jinja2.Environment:
        if cls._jinja_env is None:
            cls._jinja_env = jinja2.Environment(
                loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
                autoescape=jinja2.select_autoescape(["html", "xml"]),
            )
            cls._jinja_env.filters["kes"] = format_kes
            cls._jinja_env.filters["markdown"] = render_markdown
        return cls._jinja_env

    @classmethod
    def render_template_html(cls, template_name: str, context: dict[str, Any]) -> str:
        """Render HTML from a Jinja2 template with context."""
        env = cls.get_jinja_env()
        template = env.get_template(template_name)
        return template.render(**context)

    @classmethod
    def build_snapshot(
        cls,
        session: Session,
        resource_type: DocumentJobResourceType,
        resource_id: uuid.UUID | None = None,
        snapshot_override: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Build a JSON-serializable input snapshot for a domain resource.

        Shared between synchronous HTML previews and DocumentJob enqueueing.
        Statement remains the ADR-0005 exception and is not frozen at enqueue time.
        """
        override = dict(snapshot_override or {})
        if override.get("_frozen") is True:
            return override

        if resource_type == DocumentJobResourceType.STATEMENT:
            return cls._build_statement_snapshot(
                session=session,
                target_id=resource_id,
                override=override,
            )

        if resource_type == DocumentJobResourceType.RISK_NOTE:
            return cls._build_risk_note_snapshot(
                session=session,
                target_id=resource_id,
                override=override,
            )

        if resource_type == DocumentJobResourceType.INVOICE:
            return cls._build_invoice_snapshot(
                session=session,
                target_id=resource_id,
                override=override,
            )

        # Invitation, InvoiceBatch, or other non-Statement resources
        return {
            "_frozen": True,
            "resource_type": resource_type.value,
            "resource_id": str(resource_id) if resource_id else None,
            **jsonable_encoder(override),
        }

    @classmethod
    def _build_risk_note_snapshot(
        cls,
        *,
        session: Session,
        target_id: uuid.UUID | None,
        override: dict[str, Any],
    ) -> dict[str, Any]:
        risk_note = session.get(RiskNote, target_id) if target_id else None
        if not risk_note:
            return {
                "_frozen": True,
                "found": False,
                "target_id": str(target_id) if target_id else None,
                **jsonable_encoder(override),
            }

        policy = (
            session.get(Policy, risk_note.policy_id) if risk_note.policy_id else None
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

        vehicles: list[Any] = []
        if policy and hasattr(policy, "vehicles") and policy.vehicles:
            vehicles = list(policy.vehicles)
        elif risk_note.cover_snapshot:
            try:
                normalized = MotorPrivateRiskDetails.model_validate(
                    risk_note.cover_snapshot
                ).model_dump(mode="json")
                if normalized.get("vehicle"):
                    vehicles = [normalized["vehicle"]]
            except ValidationError:
                vehicles = []

        vehicle = vehicles[0] if vehicles else None
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
        stamp_dt = get_datetime_utc().strftime("%d %B %Y")
        special_conditions = override.get("special_conditions") or (
            risk_note.cover_snapshot.get("special_conditions")
            if risk_note.cover_snapshot
            else None
        )

        rn_number = risk_note.risk_note_number or risk_note.id
        snapshot: dict[str, Any] = {
            "_frozen": True,
            "found": True,
            "entity_type": DocumentEntityType.RISK_NOTE.value,
            "entity_id": str(risk_note.id),
            "filename": f"RiskNote_{rn_number}.pdf",
            "risk_note": jsonable_encoder(risk_note),
            "policy": jsonable_encoder(policy) if policy else None,
            "client": jsonable_encoder(client) if client else None,
            "product": jsonable_encoder(product) if product else None,
            "insurer": jsonable_encoder(insurer) if insurer else None,
            "vehicle": jsonable_encoder(vehicle) if vehicle else None,
            "vehicles": jsonable_encoder(vehicles),
            "taxes": jsonable_encoder(taxes),
            "benefits": jsonable_encoder(benefits),
            "special_conditions": special_conditions,
            "coverage_start_formatted": cov_start_str,
            "coverage_end_formatted": cov_end_str,
            "stamp_date": stamp_dt,
            "include_digital_stamp": bool(override.get("include_digital_stamp", True)),
        }
        for key, value in override.items():
            if key not in {"_frozen", "found"}:
                snapshot[key] = jsonable_encoder(value)
        return snapshot

    @classmethod
    def _build_invoice_snapshot(
        cls,
        *,
        session: Session,
        target_id: uuid.UUID | None,
        override: dict[str, Any],
    ) -> dict[str, Any]:
        invoice = session.get(Invoice, target_id) if target_id else None
        if not invoice:
            return {
                "_frozen": True,
                "found": False,
                "target_id": str(target_id) if target_id else None,
                **jsonable_encoder(override),
            }

        client = session.get(Client, invoice.client_id) if invoice.client_id else None
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

        inv_number = invoice.invoice_number or invoice.id
        inv_entity_id = invoice.client_id or invoice.id
        snapshot: dict[str, Any] = {
            "_frozen": True,
            "found": True,
            "entity_type": DocumentEntityType.CLIENT.value,
            "entity_id": str(inv_entity_id),
            "filename": f"Invoice_{inv_number}.pdf",
            "invoice": jsonable_encoder(invoice),
            "client": jsonable_encoder(client) if client else None,
            "policy": jsonable_encoder(policy) if policy else None,
            "invoice_date_formatted": inv_date_str,
            "due_date_formatted": due_date_str,
        }
        for key, value in override.items():
            if key not in {"_frozen", "found"}:
                snapshot[key] = jsonable_encoder(value)
        return snapshot

    @classmethod
    def _build_statement_snapshot(
        cls,
        *,
        session: Session,
        target_id: uuid.UUID | None,
        override: dict[str, Any],
    ) -> dict[str, Any]:
        raw_client_id = (
            target_id or override.get("client_id") or override.get("resource_id")
        )
        client_uuid: uuid.UUID | None = None
        if raw_client_id:
            try:
                client_uuid = uuid.UUID(str(raw_client_id))
            except ValueError:
                client_uuid = None

        client = session.get(Client, client_uuid) if client_uuid else None
        if client:
            statement_data = jsonable_encoder(
                ClientLedgerService.generate_statement(session, client.id).model_dump()
            )
            client_name = client.name
            client_id_val = client.id
            found = True
        else:
            client_name = override.get("client_name", "Valued Client")
            client_id_val = client_uuid or uuid.uuid4()
            found = False
            statement_data = {
                "client_id": str(client_id_val),
                "client_name": client_name,
                "kra_pin": override.get("kra_pin", "NOT SPECIFIED"),
                "total_invoiced": str(override.get("total_invoiced", "0.00")),
                "total_allocated": str(override.get("total_allocated", "0.00")),
                "net_outstanding_balance": str(
                    override.get("net_outstanding_balance", "0.00")
                ),
                "unallocated_credits": str(override.get("unallocated_credits", "0.00")),
                "invoice_count": int(override.get("invoice_count", 0)),
                "allocation_count": int(override.get("allocation_count", 0)),
                "ledger_entries": jsonable_encoder(override.get("ledger_entries", [])),
            }

        client_slug = client_name.replace(" ", "_")
        snapshot: dict[str, Any] = {
            "_frozen": True,
            "found": found,
            "entity_type": DocumentEntityType.CLIENT.value,
            "entity_id": str(client_id_val),
            "filename": f"Statement_{client_slug}_{client_id_val}.pdf",
            "statement": statement_data,
        }
        for key, value in override.items():
            if key not in {"_frozen", "found"}:
                snapshot[key] = jsonable_encoder(value)
        return snapshot

    @classmethod
    def render_html(
        cls,
        snapshot: dict[str, Any],
        *,
        resource_type: DocumentJobResourceType,
        job_id: uuid.UUID | None = None,
    ) -> RenderedDocument:
        """Render HTML content purely in-process from a frozen snapshot."""
        ref_id = job_id or uuid.uuid4()

        filename = snapshot.get("filename") or f"Document_{resource_type.value}_{ref_id}.pdf"
        raw_entity_type = snapshot.get("entity_type")
        entity_type = (
            DocumentEntityType(raw_entity_type)
            if raw_entity_type
            else DocumentEntityType.CLIENT
        )
        raw_entity_id = snapshot.get("entity_id") or snapshot.get("target_id")
        entity_id: uuid.UUID | None = (
            uuid.UUID(str(raw_entity_id)) if raw_entity_id else ref_id
        )
        fallback_title = f"{resource_type.value.replace('_', ' ').title()}"
        fallback_lines: list[str] = [
            f"Resource Type: {resource_type.value}",
            f"Resource ID: {raw_entity_id}",
            f"Rendered At: {get_datetime_utc().isoformat()}",
        ]

        if resource_type == DocumentJobResourceType.RISK_NOTE:
            return cls._render_risk_note(
                ref_id=ref_id,
                snapshot=snapshot,
                filename=filename,
                entity_type=entity_type,
                entity_id=entity_id,
                fallback_title=fallback_title,
                fallback_lines=fallback_lines,
            )

        if resource_type == DocumentJobResourceType.INVOICE:
            return cls._render_invoice(
                ref_id=ref_id,
                snapshot=snapshot,
                filename=filename,
                entity_type=entity_type,
                entity_id=entity_id,
                fallback_title=fallback_title,
                fallback_lines=fallback_lines,
            )

        if resource_type == DocumentJobResourceType.STATEMENT:
            return cls._render_statement(
                ref_id=ref_id,
                snapshot=snapshot,
                fallback_lines=fallback_lines,
            )

        fallback_title = f"Document {resource_type.value}"
        rendered_html = (
            f"<!DOCTYPE html><html><body><h1>{fallback_title}</h1>"
            "<p>Rendered via HealthWatch MS document pipeline.</p></body></html>"
        )
        return RenderedDocument(
            html=rendered_html,
            filename=filename,
            entity_type=entity_type,
            entity_id=entity_id,
            fallback_title=fallback_title,
            fallback_lines=fallback_lines,
        )

    @classmethod
    def render_pdf(
        cls,
        snapshot: dict[str, Any],
        *,
        resource_type: DocumentJobResourceType,
        job_id: uuid.UUID | None = None,
        rasterizer: PdfRasterizer | None = None,
    ) -> RenderedDocument:
        """Render HTML and PDF bytes purely in-process from a frozen snapshot."""
        rendered = cls.render_html(
            snapshot,
            resource_type=resource_type,
            job_id=job_id,
        )
        active_rasterizer = rasterizer or cls.pdf_rasterizer
        pdf_bytes = active_rasterizer.render(rendered.html)
        if not pdf_bytes or not pdf_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF output from rasterizer")
        return replace(rendered, pdf_bytes=pdf_bytes)

    @classmethod
    def _render_risk_note(
        cls,
        *,
        ref_id: uuid.UUID,
        snapshot: dict[str, Any],
        filename: str,
        entity_type: DocumentEntityType,
        entity_id: uuid.UUID | None,
        fallback_title: str,
        fallback_lines: list[str],
    ) -> RenderedDocument:
        if not snapshot.get("found") or not snapshot.get("risk_note"):
            target_id = snapshot.get("target_id")
            rendered_html = (
                f"<!DOCTYPE html><html><body><h1>Risk Note</h1>"
                f"<p>ID: {target_id or ref_id}</p></body></html>"
            )
            return RenderedDocument(
                html=rendered_html,
                filename=filename,
                entity_type=entity_type,
                entity_id=entity_id,
                fallback_title=fallback_title,
                fallback_lines=fallback_lines,
            )

        risk_note = snapshot["risk_note"]
        policy = snapshot.get("policy")
        client = snapshot.get("client")
        product = snapshot.get("product")
        insurer = snapshot.get("insurer")
        vehicle = snapshot.get("vehicle")
        vehicles = snapshot.get("vehicles", [])
        taxes = snapshot.get("taxes", {})
        benefits = snapshot.get("benefits", [])
        special_conditions = snapshot.get("special_conditions")
        cov_start_str = snapshot.get("coverage_start_formatted", "")
        cov_end_str = snapshot.get("coverage_end_formatted", "")
        stamp_dt = snapshot.get("stamp_date", "")
        include_digital_stamp = bool(snapshot.get("include_digital_stamp", True))

        rendered_html = cls.render_template_html(
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
                "special_conditions": special_conditions,
                "coverage_start_formatted": cov_start_str,
                "coverage_end_formatted": cov_end_str,
                "stamp_date": stamp_dt,
                "include_digital_stamp": include_digital_stamp,
                "generated_at": get_datetime_utc().strftime("%Y-%m-%d %H:%M:%S UTC"),
            },
        )
        rn_number = risk_note.get("risk_note_number") or risk_note.get("id")
        rn_id = uuid.UUID(str(risk_note["id"]))
        resolved_filename = snapshot.get("filename") or f"RiskNote_{rn_number}.pdf"
        resolved_entity_type = (
            DocumentEntityType(snapshot["entity_type"])
            if snapshot.get("entity_type")
            else DocumentEntityType.RISK_NOTE
        )
        resolved_entity_id = (
            uuid.UUID(str(snapshot["entity_id"]))
            if snapshot.get("entity_id")
            else rn_id
        )
        fallback_lines.extend(
            [
                f"Policy Number: {policy.get('policy_number') if policy else 'N/A'}",
                f"Client: {client.get('name') if client else 'N/A'}",
                f"Net Premium: KES {risk_note.get('net_premium')}",
            ]
        )
        return RenderedDocument(
            html=rendered_html,
            filename=resolved_filename,
            entity_type=resolved_entity_type,
            entity_id=resolved_entity_id,
            fallback_title=f"Risk Note {rn_number}",
            fallback_lines=fallback_lines,
        )

    @classmethod
    def _render_invoice(
        cls,
        *,
        ref_id: uuid.UUID,
        snapshot: dict[str, Any],
        filename: str,
        entity_type: DocumentEntityType,
        entity_id: uuid.UUID | None,
        fallback_title: str,
        fallback_lines: list[str],
    ) -> RenderedDocument:
        if not snapshot.get("found") or not snapshot.get("invoice"):
            target_id = snapshot.get("target_id")
            rendered_html = (
                f"<!DOCTYPE html><html><body><h1>Invoice</h1>"
                f"<p>ID: {target_id or ref_id}</p></body></html>"
            )
            return RenderedDocument(
                html=rendered_html,
                filename=filename,
                entity_type=entity_type,
                entity_id=entity_id,
                fallback_title=fallback_title,
                fallback_lines=fallback_lines,
            )

        invoice = snapshot["invoice"]
        client = snapshot.get("client")
        policy = snapshot.get("policy")
        inv_date_str = snapshot.get("invoice_date_formatted", "")
        due_date_str = snapshot.get("due_date_formatted", "")

        rendered_html = cls.render_template_html(
            "invoice.html",
            {
                "invoice": invoice,
                "client": client,
                "policy": policy,
                "invoice_date_formatted": inv_date_str,
                "due_date_formatted": due_date_str,
                "generated_at": get_datetime_utc().strftime("%Y-%m-%d %H:%M:%S UTC"),
            },
        )
        inv_number = invoice.get("invoice_number") or invoice.get("id")
        inv_client_id = invoice.get("client_id")
        inv_id = uuid.UUID(str(invoice["id"]))
        resolved_filename = snapshot.get("filename") or f"Invoice_{inv_number}.pdf"
        resolved_entity_type = (
            DocumentEntityType(snapshot["entity_type"])
            if snapshot.get("entity_type")
            else DocumentEntityType.CLIENT
        )
        resolved_entity_id = (
            uuid.UUID(str(snapshot["entity_id"]))
            if snapshot.get("entity_id")
            else (uuid.UUID(str(inv_client_id)) if inv_client_id else inv_id)
        )
        fallback_lines.extend(
            [
                f"Client: {client.get('name') if client else 'N/A'}",
                f"Invoice Amount: KES {invoice.get('total_amount')}",
                f"Status: {invoice.get('status')}",
            ]
        )
        return RenderedDocument(
            html=rendered_html,
            filename=resolved_filename,
            entity_type=resolved_entity_type,
            entity_id=resolved_entity_id,
            fallback_title=f"Invoice {inv_number}",
            fallback_lines=fallback_lines,
        )

    @classmethod
    def _render_statement(
        cls,
        *,
        ref_id: uuid.UUID,
        snapshot: dict[str, Any],
        fallback_lines: list[str],
    ) -> RenderedDocument:
        raw_client_id = snapshot.get("client_id") or snapshot.get("resource_id") or snapshot.get("entity_id")
        client_uuid: uuid.UUID | None = None
        if raw_client_id:
            try:
                client_uuid = uuid.UUID(str(raw_client_id))
            except ValueError:
                client_uuid = None

        if "statement" in snapshot and isinstance(snapshot["statement"], dict):
            statement_data = snapshot["statement"]
            client_name = statement_data.get("client_name", "Valued Client")
            client_id_val = uuid.UUID(str(statement_data.get("client_id") or client_uuid or ref_id))
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
                "unallocated_credits": str(snapshot.get("unallocated_credits", "0.00")),
                "invoice_count": int(snapshot.get("invoice_count", 0)),
                "allocation_count": int(snapshot.get("allocation_count", 0)),
                "ledger_entries": snapshot.get("ledger_entries", []),
            }

        has_unallocated_credits = Decimal(
            str(statement_data.get("unallocated_credits") or "0.00")
        ) > Decimal("0.00")
        rendered_html = cls.render_template_html(
            "statement.html",
            {
                "statement": statement_data,
                "has_unallocated_credits": has_unallocated_credits,
                "generated_at": get_datetime_utc().strftime("%Y-%m-%d %H:%M:%S UTC"),
            },
        )
        client_slug = client_name.replace(" ", "_")
        resolved_filename = snapshot.get("filename") or f"Statement_{client_slug}_{client_id_val}.pdf"
        resolved_entity_type = (
            DocumentEntityType(snapshot["entity_type"])
            if snapshot.get("entity_type")
            else DocumentEntityType.CLIENT
        )
        resolved_entity_id = (
            uuid.UUID(str(snapshot["entity_id"]))
            if snapshot.get("entity_id")
            else client_id_val
        )
        fallback_lines.extend(
            [
                f"Client Name: {client_name}",
                f"Outstanding Balance: KES {statement_data.get('net_outstanding_balance')}",
                f"Invoices: {statement_data.get('invoice_count')}",
            ]
        )
        return RenderedDocument(
            html=rendered_html,
            filename=resolved_filename,
            entity_type=resolved_entity_type,
            entity_id=resolved_entity_id,
            fallback_title=f"Statement - {client_name}",
            fallback_lines=fallback_lines,
        )
