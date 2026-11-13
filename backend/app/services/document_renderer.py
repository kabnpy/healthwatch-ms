import logging
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, replace
from decimal import Decimal
from pathlib import Path
from typing import Any

import jinja2
from markdown_it import MarkdownIt
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
from app.services.statement import ClientStatementService

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


class DocumentRenderer:
    """Loads domain resources, normalizes snapshots, and renders Jinja2 HTML."""

    _jinja_env: jinja2.Environment | None = None

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
    def render_html(
        cls,
        session: Session,
        resource_type: DocumentJobResourceType,
        resource_id: uuid.UUID | None = None,
        snapshot_override: dict[str, Any] | None = None,
        job_id: uuid.UUID | None = None,
    ) -> RenderedDocument:
        """Render HTML content for a domain resource and optional draft snapshot."""
        snapshot = snapshot_override or {}
        target_id = resource_id
        ref_id = job_id or uuid.uuid4()

        filename = f"Document_{resource_type.value}_{ref_id}.pdf"
        entity_type = DocumentEntityType.CLIENT
        entity_id: uuid.UUID | None = target_id or ref_id
        fallback_title = f"{resource_type.value.replace('_', ' ').title()}"
        fallback_lines: list[str] = [
            f"Resource Type: {resource_type.value}",
            f"Resource ID: {resource_id}",
            f"Rendered At: {get_datetime_utc().isoformat()}",
        ]

        if resource_type == DocumentJobResourceType.RISK_NOTE:
            return cls._render_risk_note(
                session=session,
                target_id=target_id,
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
                session=session,
                target_id=target_id,
                ref_id=ref_id,
                filename=filename,
                entity_type=entity_type,
                entity_id=entity_id,
                fallback_title=fallback_title,
                fallback_lines=fallback_lines,
            )

        if resource_type == DocumentJobResourceType.STATEMENT:
            return cls._render_statement(
                session=session,
                target_id=target_id,
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
        session: Session,
        resource_type: DocumentJobResourceType,
        resource_id: uuid.UUID | None = None,
        snapshot_override: dict[str, Any] | None = None,
        job_id: uuid.UUID | None = None,
    ) -> RenderedDocument:
        """Render HTML and PDF bytes for a domain resource and optional draft snapshot."""
        rendered = cls.render_html(
            session=session,
            resource_type=resource_type,
            resource_id=resource_id,
            snapshot_override=snapshot_override,
            job_id=job_id,
        )
        pdf_bytes = cls._render_pdf_bytes(
            html_content=rendered.html,
            fallback_title=rendered.fallback_title,
            fallback_lines=rendered.fallback_lines,
        )
        return replace(rendered, pdf_bytes=pdf_bytes)

    @classmethod
    def _render_pdf_bytes(
        cls,
        html_content: str,
        fallback_title: str = "HealthWatch MS Document",
        fallback_lines: list[str] | None = None,
    ) -> bytes:
        """Render HTML into A4 PDF bytes via Bun+Playwright, with pure-Python fallback."""
        bun_bin = shutil.which("bun")

        if bun_bin and FRONTEND_RENDER_SCRIPT.exists():
            with tempfile.NamedTemporaryFile(
                "w", suffix=".html", delete=False
            ) as tmp_html:
                tmp_html.write(html_content)
                tmp_html_path = Path(tmp_html.name)

            with tempfile.NamedTemporaryFile(
                "wb", suffix=".pdf", delete=False
            ) as tmp_pdf:
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
                if (
                    result.returncode == 0
                    and tmp_pdf_path.exists()
                    and tmp_pdf_path.stat().st_size > 0
                ):
                    logger.info("PDF successfully rendered via Bun Playwright")
                    return tmp_pdf_path.read_bytes()
                logger.warning(
                    "Bun Playwright rendering failed (code %d): %s, using fallback",
                    result.returncode,
                    result.stderr,
                )
            except Exception as e:
                logger.warning(
                    "Bun Playwright rendering encountered exception: %s, using fallback",
                    e,
                )
            finally:
                if tmp_html_path.exists():
                    tmp_html_path.unlink()
                if tmp_pdf_path.exists():
                    tmp_pdf_path.unlink()

        logger.info("Generating PDF using pure Python fallback")
        lines = fallback_lines or [
            "HealthWatch Insurance Agency Ltd",
            "Nairobi, Kenya",
            f"Document Title: {fallback_title}",
            "Rendered via HealthWatch MS Document Pipeline",
        ]
        return cls._generate_fallback_pdf(fallback_title, lines)

    @staticmethod
    def _generate_fallback_pdf(title: str, text_lines: list[str]) -> bytes:
        """Generate a minimal valid PDF-1.4 document in pure Python without external dependencies."""
        content_lines = ["BT", "/F1 12 Tf", "50 750 Td", "14 TL"]
        escaped_title = (
            title.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        )
        content_lines.append(f"({escaped_title}) '")
        content_lines.append("() '")

        for line in text_lines[:45]:
            escaped = (
                str(line).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            )
            content_lines.append(f"({escaped}) '")
        content_lines.append("ET")

        stream_data = "\n".join(content_lines).encode("latin-1", "replace")
        stream_len = len(stream_data)

        objects = [
            b"%PDF-1.4\n",
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
            f"4 0 obj\n<< /Length {stream_len} >>\nstream\n".encode("latin-1")
            + stream_data
            + b"\nendstream\nendobj\n",
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        ]

        offsets = []
        curr_offset = 0
        pdf_bytes = b""
        for i, obj in enumerate(objects):
            if i > 0:
                offsets.append(curr_offset)
            curr_offset += len(obj)
            pdf_bytes += obj

        xref_offset = curr_offset
        xref = f"xref\n0 {len(objects)}\n0000000000 65535 f \n".encode("latin-1")
        for off in offsets:
            xref += f"{off:010d} 00000 n \n".encode("latin-1")

        trailer = f"trailer\n<< /Size {len(objects)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
            "latin-1"
        )
        return pdf_bytes + xref + trailer

    @classmethod
    def _render_risk_note(
        cls,
        *,
        session: Session,
        target_id: uuid.UUID | None,
        ref_id: uuid.UUID,
        snapshot: dict[str, Any],
        filename: str,
        entity_type: DocumentEntityType,
        entity_id: uuid.UUID | None,
        fallback_title: str,
        fallback_lines: list[str],
    ) -> RenderedDocument:
        risk_note = session.get(RiskNote, target_id) if target_id else None
        if not risk_note:
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
        include_digital_stamp = bool(snapshot.get("include_digital_stamp", True))

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
        special_conditions = snapshot.get("special_conditions") or (
            risk_note.cover_snapshot.get("special_conditions")
            if risk_note.cover_snapshot
            else None
        )

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
        fallback_lines.extend(
            [
                f"Policy Number: {policy.policy_number if policy else 'N/A'}",
                f"Client: {client.name if client else 'N/A'}",
                f"Net Premium: KES {risk_note.net_premium}",
            ]
        )
        return RenderedDocument(
            html=rendered_html,
            filename=f"RiskNote_{risk_note.risk_note_number or risk_note.id}.pdf",
            entity_type=DocumentEntityType.RISK_NOTE,
            entity_id=risk_note.id,
            fallback_title=f"Risk Note {risk_note.risk_note_number or risk_note.id}",
            fallback_lines=fallback_lines,
        )

    @classmethod
    def _render_invoice(
        cls,
        *,
        session: Session,
        target_id: uuid.UUID | None,
        ref_id: uuid.UUID,
        filename: str,
        entity_type: DocumentEntityType,
        entity_id: uuid.UUID | None,
        fallback_title: str,
        fallback_lines: list[str],
    ) -> RenderedDocument:
        invoice = session.get(Invoice, target_id) if target_id else None
        if not invoice:
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
        fallback_lines.extend(
            [
                f"Client: {client.name if client else 'N/A'}",
                f"Invoice Amount: KES {invoice.total_amount}",
                f"Status: {invoice.status.value}",
            ]
        )
        return RenderedDocument(
            html=rendered_html,
            filename=f"Invoice_{invoice.invoice_number or invoice.id}.pdf",
            entity_type=DocumentEntityType.CLIENT,
            entity_id=invoice.client_id or invoice.id,
            fallback_title=f"Invoice {invoice.invoice_number or invoice.id}",
            fallback_lines=fallback_lines,
        )

    @classmethod
    def _render_statement(
        cls,
        *,
        session: Session,
        target_id: uuid.UUID | None,
        ref_id: uuid.UUID,
        snapshot: dict[str, Any],
        fallback_lines: list[str],
    ) -> RenderedDocument:
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

        rendered_html = cls.render_template_html(
            "statement.html",
            {
                "statement": statement_data,
                "generated_at": get_datetime_utc().strftime("%Y-%m-%d %H:%M:%S UTC"),
            },
        )
        client_slug = client_name.replace(" ", "_")
        fallback_lines.extend(
            [
                f"Client Name: {client_name}",
                f"Outstanding Balance: KES {statement_data.get('net_outstanding_balance')}",
                f"Invoices: {statement_data.get('invoice_count')}",
            ]
        )
        return RenderedDocument(
            html=rendered_html,
            filename=f"Statement_{client_slug}_{client_id_val}.pdf",
            entity_type=DocumentEntityType.CLIENT,
            entity_id=client_id_val,
            fallback_title=f"Statement - {client_name}",
            fallback_lines=fallback_lines,
        )
