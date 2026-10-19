"""Add Phase 3 and Phase 4 Rate Tables, Calculations, IPF, Commission, Invoicing, and Document Jobs

Revision ID: 4b5c6d7e8f9a
Revises: 3a4b5c6d7e8f
Create Date: 2026-10-19 03:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "4b5c6d7e8f9a"
down_revision = "3a4b5c6d7e8f"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create Enums
    pricing_method_enum = sa.Enum(
        "BRACKETED_PERCENTAGE",
        "FIXED_TARIFF",
        "MULTI_COMPONENT_SUM_INSURED",
        "CENSUS_DEFINED_BENEFIT",
        "DECLARED_PAYROLL_PERCENTAGE",
        "LIMIT_OF_INDEMNITY",
        name="pricingmethod",
    )
    rate_table_status_enum = sa.Enum(
        "DRAFT",
        "ACTIVE",
        "ARCHIVED",
        name="ratetablestatus",
    )
    benefit_calc_type_enum = sa.Enum(
        "PERCENTAGE",
        "FIXED_AMOUNT",
        "PER_MEMBER",
        name="benefitcalculationtype",
    )
    business_event_enum = sa.Enum(
        "NEW_BUSINESS",
        "RENEWAL",
        "ENDORSEMENT",
        name="businessevent",
    )
    ipf_status_enum = sa.Enum(
        "PENDING_DEPOSIT",
        "DEPOSIT_CONFIRMED",
        "SUBMITTED_TO_FINANCIER",
        "APPROVED",
        "DISBURSED",
        "REJECTED",
        name="ipfstatus",
    )
    product_line_enum = sa.Enum(
        "MOTOR_PRIVATE",
        "MOTOR_COMMERCIAL",
        "DOMESTIC_PACKAGE",
        "FIRE_INDUSTRIAL",
        "WIBA",
        "BURGLARY",
        "MARINE_CARGO",
        "PUBLIC_LIABILITY",
        "PROFESSIONAL_INDEMNITY",
        "DIRECTORS_AND_OFFICERS",
        "HEALTHCARE_INDIVIDUAL",
        "HEALTHCARE_CORPORATE",
        name="productline",
    )
    doc_job_resource_type_enum = sa.Enum(
        "POLICY_SCHEDULE",
        "RISK_NOTE",
        "INVOICE",
        "RECEIPT",
        "CLIENT_STATEMENT",
        "INVITATION",
        "RENEWAL_NOTICE",
        "COMMISSION_STATEMENT",
        name="documentjobresourcetype",
    )
    doc_job_status_enum = sa.Enum(
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        name="documentjobstatus",
    )

    # 2. Table: ratetableversion
    op.create_table(
        "ratetableversion",
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("deleted_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("insurer_id", sa.Uuid(), nullable=False),
        sa.Column("class_of_insurance", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("pricing_method", pricing_method_enum, nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", rate_table_status_enum, nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("source_reference", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("change_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["insurer_id"], ["insurer.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ratetableversion_insurer_id"), "ratetableversion", ["insurer_id"], unique=False)
    op.create_index(op.f("ix_ratetableversion_class_of_insurance"), "ratetableversion", ["class_of_insurance"], unique=False)
    op.create_index(op.f("ix_ratetableversion_status"), "ratetableversion", ["status"], unique=False)
    op.create_index(op.f("ix_ratetableversion_deleted_at"), "ratetableversion", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_ratetableversion_deleted_by_id"), "ratetableversion", ["deleted_by_id"], unique=False)

    # 3. Table: ratebracket
    op.create_table(
        "ratebracket",
        sa.Column("rate_table_version_id", sa.Uuid(), nullable=False),
        sa.Column("min_value", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("max_value", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("rate_percent", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column("minimum_premium", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("display_label", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["rate_table_version_id"], ["ratetableversion.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ratebracket_rate_table_version_id"), "ratebracket", ["rate_table_version_id"], unique=False)

    # 4. Table: ratebenefit
    op.create_table(
        "ratebenefit",
        sa.Column("rate_table_version_id", sa.Uuid(), nullable=False),
        sa.Column("code", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("calculation_type", benefit_calc_type_enum, nullable=False),
        sa.Column("rate_value", sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False),
        sa.Column("is_complimentary", sa.Boolean(), nullable=False),
        sa.Column("complimentary_threshold", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["rate_table_version_id"], ["ratetableversion.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ratebenefit_rate_table_version_id"), "ratebenefit", ["rate_table_version_id"], unique=False)
    op.create_index(op.f("ix_ratebenefit_code"), "ratebenefit", ["code"], unique=False)

    # 5. Table: medicaltier
    op.create_table(
        "medicaltier",
        sa.Column("rate_table_version_id", sa.Uuid(), nullable=False),
        sa.Column("tier_code", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("benefit_limits", sa.JSON(), nullable=True),
        sa.Column("premium", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["rate_table_version_id"], ["ratetableversion.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_medicaltier_rate_table_version_id"), "medicaltier", ["rate_table_version_id"], unique=False)
    op.create_index(op.f("ix_medicaltier_tier_code"), "medicaltier", ["tier_code"], unique=False)

    # 6. Table: taxraterule
    op.create_table(
        "taxraterule",
        sa.Column("code", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("rate_percent", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column("calculation_basis", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("sequence_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_taxraterule_code"), "taxraterule", ["code"], unique=True)

    # 7. Table: premiumcalculation
    op.create_table(
        "premiumcalculation",
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("renewal_id", sa.Uuid(), nullable=True),
        sa.Column("business_event", business_event_enum, nullable=False),
        sa.Column("rating_date", sa.Date(), nullable=False),
        sa.Column("rate_table_version_id", sa.Uuid(), nullable=True),
        sa.Column("input_snapshot", sa.JSON(), nullable=True),
        sa.Column("rule_provenance", sa.JSON(), nullable=True),
        sa.Column("calculation_detail", sa.JSON(), nullable=True),
        sa.Column("total_premium", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("is_selected", sa.Boolean(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["policy_id"], ["policy.id"]),
        sa.ForeignKeyConstraint(["renewal_id"], ["renewal.id"]),
        sa.ForeignKeyConstraint(["rate_table_version_id"], ["ratetableversion.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_premiumcalculation_policy_id"), "premiumcalculation", ["policy_id"], unique=False)
    op.create_index(op.f("ix_premiumcalculation_renewal_id"), "premiumcalculation", ["renewal_id"], unique=False)
    op.create_index(op.f("ix_premiumcalculation_rate_table_version_id"), "premiumcalculation", ["rate_table_version_id"], unique=False)
    op.create_index(op.f("ix_premiumcalculation_created_by_id"), "premiumcalculation", ["created_by_id"], unique=False)

    # 8. Table: invitation
    op.create_table(
        "invitation",
        sa.Column("renewal_id", sa.Uuid(), nullable=False),
        sa.Column("calculation_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("rendered_snapshot", sa.JSON(), nullable=True),
        sa.Column("generated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["renewal_id"], ["renewal.id"]),
        sa.ForeignKeyConstraint(["calculation_id"], ["premiumcalculation.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invitation_renewal_id"), "invitation", ["renewal_id"], unique=False)
    op.create_index(op.f("ix_invitation_calculation_id"), "invitation", ["calculation_id"], unique=False)
    op.create_index(op.f("ix_invitation_created_by_id"), "invitation", ["created_by_id"], unique=False)

    # 9. Table: ipfagreement
    op.create_table(
        "ipfagreement",
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("deleted_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("financier_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("agreement_reference", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("total_financed_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("deposit_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("number_of_installments", sa.Integer(), nullable=False),
        sa.Column("monthly_installment", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("commitment_letter_document_id", sa.Uuid(), nullable=True),
        sa.Column("status", ipf_status_enum, nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.ForeignKeyConstraint(["policy_id"], ["policy.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoice.id"]),
        sa.ForeignKeyConstraint(["commitment_letter_document_id"], ["document.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ipfagreement_client_id"), "ipfagreement", ["client_id"], unique=False)
    op.create_index(op.f("ix_ipfagreement_policy_id"), "ipfagreement", ["policy_id"], unique=False)
    op.create_index(op.f("ix_ipfagreement_invoice_id"), "ipfagreement", ["invoice_id"], unique=False)
    op.create_index(op.f("ix_ipfagreement_agreement_reference"), "ipfagreement", ["agreement_reference"], unique=False)
    op.create_index(op.f("ix_ipfagreement_commitment_letter_document_id"), "ipfagreement", ["commitment_letter_document_id"], unique=False)
    op.create_index(op.f("ix_ipfagreement_status"), "ipfagreement", ["status"], unique=False)
    op.create_index(op.f("ix_ipfagreement_deleted_at"), "ipfagreement", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_ipfagreement_deleted_by_id"), "ipfagreement", ["deleted_by_id"], unique=False)

    # 10. Table: commissionschedule
    op.create_table(
        "commissionschedule",
        sa.Column("insurer_id", sa.Uuid(), nullable=False),
        sa.Column("product_line", product_line_enum, nullable=False),
        sa.Column("commission_rate_percent", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column("withholding_tax_percent", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["insurer_id"], ["insurer.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_commissionschedule_insurer_id"), "commissionschedule", ["insurer_id"], unique=False)
    op.create_index(op.f("ix_commissionschedule_product_line"), "commissionschedule", ["product_line"], unique=False)

    # 11. Table: invoicebatch
    op.create_table(
        "invoicebatch",
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("billing_month", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("batch_number", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("included_invoice_ids", sa.JSON(), nullable=True),
        sa.Column("generated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("storage_key", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoicebatch_client_id"), "invoicebatch", ["client_id"], unique=False)
    op.create_index(op.f("ix_invoicebatch_billing_month"), "invoicebatch", ["billing_month"], unique=False)
    op.create_index(op.f("ix_invoicebatch_batch_number"), "invoicebatch", ["batch_number"], unique=True)
    # Unique composite index: 1 batch per client per month
    op.create_index(
        "uq_invoicebatch_client_billing_month",
        "invoicebatch",
        ["client_id", "billing_month"],
        unique=True,
    )

    # 12. Table: documentjob
    op.create_table(
        "documentjob",
        sa.Column("resource_type", doc_job_resource_type_enum, nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("status", doc_job_status_enum, nullable=False),
        sa.Column("idempotency_key", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("snapshot_data", sa.JSON(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("error_code", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("error_message", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documentjob_resource_type"), "documentjob", ["resource_type"], unique=False)
    op.create_index(op.f("ix_documentjob_resource_id"), "documentjob", ["resource_id"], unique=False)
    op.create_index(op.f("ix_documentjob_status"), "documentjob", ["status"], unique=False)
    op.create_index(op.f("ix_documentjob_idempotency_key"), "documentjob", ["idempotency_key"], unique=False)

    # 13. Update table claim with additional advocacy fields
    with op.batch_alter_table("claim") as batch_op:
        batch_op.add_column(sa.Column("client_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("vehicle_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("loss_type", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column("loss_description", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column("estimated_reserve", sa.Numeric(precision=15, scale=2), nullable=True))
        batch_op.add_column(sa.Column("settled_amount", sa.Numeric(precision=15, scale=2), nullable=True))
        batch_op.add_column(sa.Column("assigned_adjuster", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.create_foreign_key("fk_claim_client_id", "client", ["client_id"], ["id"])
        batch_op.create_foreign_key("fk_claim_vehicle_id", "vehicle", ["vehicle_id"], ["id"])
        batch_op.create_index("ix_claim_client_id", ["client_id"], unique=False)
        batch_op.create_index("ix_claim_vehicle_id", ["vehicle_id"], unique=False)


def downgrade():
    with op.batch_alter_table("claim") as batch_op:
        batch_op.drop_index("ix_claim_vehicle_id")
        batch_op.drop_index("ix_claim_client_id")
        batch_op.drop_constraint("fk_claim_vehicle_id", type_="foreignkey")
        batch_op.drop_constraint("fk_claim_client_id", type_="foreignkey")
        batch_op.drop_column("assigned_adjuster")
        batch_op.drop_column("settled_amount")
        batch_op.drop_column("estimated_reserve")
        batch_op.drop_column("loss_description")
        batch_op.drop_column("loss_type")
        batch_op.drop_column("vehicle_id")
        batch_op.drop_column("client_id")

    op.drop_table("documentjob")
    op.drop_table("invoicebatch")
    op.drop_table("commissionschedule")
    op.drop_table("ipfagreement")
    op.drop_table("invitation")
    op.drop_table("premiumcalculation")
    op.drop_table("taxraterule")
    op.drop_table("medicaltier")
    op.drop_table("ratebenefit")
    op.drop_table("ratebracket")
    op.drop_table("ratetableversion")
