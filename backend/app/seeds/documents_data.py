"""
Documents Seed Data.
Seeds KYC documents, logbooks, valuation reports, carrier notices,
proofs of payment, and insurer receipts with real physical files.
"""

import logging
from typing import Any

from sqlmodel import Session, select

from app.core.storage import storage
from app.models import (
    Claim,
    Client,
    Document,
    DocumentEntityType,
    DocumentType,
    Policy,
)

logger = logging.getLogger(__name__)

MINIMAL_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
)


def ensure_storage_file(relative_path: str) -> str:
    """Ensure physical file exists in storage for download preview."""
    abs_path = storage.get_file_path(relative_path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    if not abs_path.exists():
        abs_path.write_bytes(MINIMAL_PDF_BYTES)
    return relative_path


def seed_documents(
    session: Session,
    clients: dict[str, Client],
    policies: dict[str, Policy],
    claims: dict[str, Claim],
) -> list[Document]:
    """
    Seed documents across clients, policies, and claims.
    """
    documents: list[Document] = []

    def upsert_doc(
        entity_type: DocumentEntityType,
        entity_id: Any,
        document_type: DocumentType,
        relative_path: str,
        filename: str,
        extra_metadata: dict[str, Any] | None = None,
    ) -> Document:
        ensure_storage_file(relative_path)

        meta = {"filename": filename}
        if extra_metadata:
            meta.update(extra_metadata)

        existing = session.exec(
            select(Document).where(
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.document_type == document_type,
            )
        ).first()

        if not existing:
            doc = Document(
                entity_type=entity_type,
                entity_id=entity_id,
                document_type=document_type,
                file_path=relative_path,
                mime_type="application/pdf",
                doc_metadata=meta,
            )
            session.add(doc)
            session.commit()
            session.refresh(doc)
            logger.info(
                f"Seeded document {doc.id} ({document_type.value}) for {entity_type.value}"
            )
            return doc
        else:
            existing.file_path = relative_path
            existing.doc_metadata = meta
            session.add(existing)
            session.commit()
            return existing

    # ==========================================
    # 1. Client KYC Documents
    # ==========================================
    if "A001158997L" in clients:
        c_agnes = clients["A001158997L"]
        d1 = upsert_doc(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=c_agnes.id,
            document_type=DocumentType.KRA_PIN_CERTIFICATE,
            relative_path="client/kra_pin_agnes_mwangi.pdf",
            filename="kra_pin_certificate_agnes_mwangi.pdf",
            extra_metadata={"tax_pin": "A001158997L", "taxpayer_name": c_agnes.name},
        )
        documents.append(d1)

        d2 = upsert_doc(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=c_agnes.id,
            document_type=DocumentType.NATIONAL_ID_PASSPORT,
            relative_path="client/national_id_agnes_mwangi.pdf",
            filename="national_id_agnes_mwangi.pdf",
            extra_metadata={"id_number": "24891023"},
        )
        documents.append(d2)

    if "A002849120K" in clients:
        c_kiptoo = clients["A002849120K"]
        d3 = upsert_doc(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=c_kiptoo.id,
            document_type=DocumentType.KRA_PIN_CERTIFICATE,
            relative_path="client/kra_pin_david_kiptoo.pdf",
            filename="kra_pin_certificate_david_kiptoo.pdf",
            extra_metadata={"tax_pin": "A002849120K"},
        )
        documents.append(d3)

    if "P051289412M" in clients:
        c_rv = clients["P051289412M"]
        d4 = upsert_doc(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=c_rv.id,
            document_type=DocumentType.CERTIFICATE_OF_INCORPORATION,
            relative_path="client/cert_incorp_rv_hauliers.pdf",
            filename="certificate_of_incorporation_rv_hauliers.pdf",
            extra_metadata={"registration_number": "CPR/2018/98412"},
        )
        documents.append(d4)

        d5 = upsert_doc(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=c_rv.id,
            document_type=DocumentType.KRA_PIN_CERTIFICATE,
            relative_path="client/kra_pin_rv_hauliers.pdf",
            filename="kra_pin_certificate_rv_hauliers.pdf",
            extra_metadata={"tax_pin": "P051289412M"},
        )
        documents.append(d5)

    if "P053491028L" in clients:
        c_bluenile = clients["P053491028L"]
        d6 = upsert_doc(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=c_bluenile.id,
            document_type=DocumentType.CERTIFICATE_OF_INCORPORATION,
            relative_path="client/cert_incorp_bluenile.pdf",
            filename="certificate_of_incorporation_bluenile.pdf",
            extra_metadata={"registration_number": "CPR/2016/10294"},
        )
        documents.append(d6)

    # ==========================================
    # 2. Policy Asset Documents (Logbooks & Valuations)
    # ==========================================
    if "010/070/1/012473/2017" in policies:
        pol_agnes = policies["010/070/1/012473/2017"]
        d7 = upsert_doc(
            entity_type=DocumentEntityType.POLICY,
            entity_id=pol_agnes.id,
            document_type=DocumentType.LOGBOOK,
            relative_path="policy/logbook_kcm780l_prado.pdf",
            filename="logbook_KCM780L_toyota_prado.pdf",
            extra_metadata={"registration": "KCM 780L", "chassis": "JTEBU49J10294819"},
        )
        documents.append(d7)

        d8 = upsert_doc(
            entity_type=DocumentEntityType.POLICY,
            entity_id=pol_agnes.id,
            document_type=DocumentType.VALUATION_REPORT,
            relative_path="policy/valuation_kcm780l_prado.pdf",
            filename="certified_valuation_report_kcm780l.pdf",
            extra_metadata={
                "assessor": "Regent Valuers Ltd.",
                "appraised_value": 5000000,
            },
        )
        documents.append(d8)

    if "JUB/POL/MOT/2024/09124" in policies:
        pol_kiptoo = policies["JUB/POL/MOT/2024/09124"]
        d9 = upsert_doc(
            entity_type=DocumentEntityType.POLICY,
            entity_id=pol_kiptoo.id,
            document_type=DocumentType.LOGBOOK,
            relative_path="policy/logbook_kda410m_subaru.pdf",
            filename="logbook_KDA410M_subaru_outback.pdf",
            extra_metadata={"registration": "KDA 410M"},
        )
        documents.append(d9)

    if "BRT/MOT/2024/004812" in policies:
        pol_grace = policies["BRT/MOT/2024/004812"]
        d10 = upsert_doc(
            entity_type=DocumentEntityType.POLICY,
            entity_id=pol_grace.id,
            document_type=DocumentType.LOGBOOK,
            relative_path="policy/logbook_kdb892p_mercedes.pdf",
            filename="logbook_KDB892P_mercedes_c200.pdf",
            extra_metadata={"registration": "KDB 892P"},
        )
        documents.append(d10)

    if "ICEA/MOT/2024/00091" in policies:
        pol_mutiso = policies["ICEA/MOT/2024/00091"]
        d11 = upsert_doc(
            entity_type=DocumentEntityType.POLICY,
            entity_id=pol_mutiso.id,
            document_type=DocumentType.LOGBOOK,
            relative_path="policy/logbook_kdf001m_lc300.pdf",
            filename="logbook_KDF001M_toyota_lc300.pdf",
            extra_metadata={"registration": "KDF 001M"},
        )
        documents.append(d11)

        d12 = upsert_doc(
            entity_type=DocumentEntityType.POLICY,
            entity_id=pol_mutiso.id,
            document_type=DocumentType.VALUATION_REPORT,
            relative_path="policy/valuation_kdf001m_lc300.pdf",
            filename="certified_valuation_report_kdf001m.pdf",
            extra_metadata={
                "assessor": "Fairway Valuers",
                "appraised_value": 11500000,
            },
        )
        documents.append(d12)

    # ==========================================
    # 3. Claims Documents
    # ==========================================
    if "CLM/OM/2026/00142" in claims:
        clm1 = claims["CLM/OM/2026/00142"]
        d13 = upsert_doc(
            entity_type=DocumentEntityType.CLAIM,
            entity_id=clm1.id,
            document_type=DocumentType.RECEIPT,
            relative_path="claim/autoglass_settlement_receipt.pdf",
            filename="autoglass_replacement_receipt_voucher.pdf",
            extra_metadata={"amount": 35000, "vendor": "AutoGlass Kenya Ltd."},
        )
        documents.append(d13)

    if "CLM/OM/2026/00219" in claims:
        clm2 = claims["CLM/OM/2026/00219"]
        d14 = upsert_doc(
            entity_type=DocumentEntityType.CLAIM,
            entity_id=clm2.id,
            document_type=DocumentType.POLICE_ABSTRACT,
            relative_path="claim/police_abstract_mombasa_port.pdf",
            filename="police_abstract_ob42_mombasa_port.pdf",
            extra_metadata={"ob_number": "OB 42/18/10/2026"},
        )
        documents.append(d14)

        d15 = upsert_doc(
            entity_type=DocumentEntityType.CLAIM,
            entity_id=clm2.id,
            document_type=DocumentType.REPAIR_ESTIMATE,
            relative_path="claim/ava_repair_estimate_isuzu.pdf",
            filename="ava_dealership_repair_estimate.pdf",
            extra_metadata={"estimated_cost": 185000},
        )
        documents.append(d15)

    return documents
