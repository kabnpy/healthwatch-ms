"""Add Phase 2 Vehicle, Renewal, Activity, and Payment models

Revision ID: 3a4b5c6d7e8f
Revises: 19bab995ff26
Create Date: 2026-10-18 21:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "3a4b5c6d7e8f"
down_revision = "19bab995ff26"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create Vehicle Table
    op.create_table(
        "vehicle",
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("deleted_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("registration_number", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("make", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("model", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("year_of_manufacture", sa.Integer(), nullable=False),
        sa.Column("insured_value", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("chassis_number", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("engine_number", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["policy_id"], ["policy.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vehicle_deleted_at"), "vehicle", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_vehicle_deleted_by_id"), "vehicle", ["deleted_by_id"], unique=False)
    op.create_index(op.f("ix_vehicle_policy_id"), "vehicle", ["policy_id"], unique=False)
    op.create_index(op.f("ix_vehicle_registration_number"), "vehicle", ["registration_number"], unique=False)

    # 2. Create Renewal Table
    renewal_status_enum = sa.Enum(
        "AWAITING_CARRIER",
        "CARRIER_RECEIVED",
        "CLIENT_INVITED",
        "CHANGES_REQUESTED",
        "PAID",
        "COMPLETED",
        "CANCELLED",
        name="renewalstatus",
    )
    op.create_table(
        "renewal",
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("deleted_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("status", renewal_status_enum, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("renewal_period_start", sa.Date(), nullable=False),
        sa.Column("renewal_period_end", sa.Date(), nullable=False),
        sa.Column("previous_premium", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("proposed_premium", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("agreed_premium", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("selected_calculation_id", sa.Uuid(), nullable=True),
        sa.Column("carrier_document_key", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("carrier_received_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("invited_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("paid_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("completed_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["policy_id"], ["policy.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_renewal_deleted_at"), "renewal", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_renewal_deleted_by_id"), "renewal", ["deleted_by_id"], unique=False)
    op.create_index(op.f("ix_renewal_policy_id"), "renewal", ["policy_id"], unique=False)
    op.create_index(op.f("ix_renewal_status"), "renewal", ["status"], unique=False)
    op.create_index(op.f("ix_renewal_selected_calculation_id"), "renewal", ["selected_calculation_id"], unique=False)

    # Enforce Invariant: At most one active renewal per policy
    op.create_index(
        "uq_policy_single_active_renewal",
        "renewal",
        ["policy_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('COMPLETED', 'CANCELLED')"),
    )

    # 3. Create Activity Table
    activity_type_enum = sa.Enum(
        "NOTE",
        "PHONE_CALL",
        "EMAIL",
        "MEETING",
        "REMINDER",
        "SYSTEM",
        name="activitytype",
    )
    op.create_table(
        "activity",
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=True),
        sa.Column("renewal_id", sa.Uuid(), nullable=True),
        sa.Column("activity_type", activity_type_enum, nullable=False),
        sa.Column("body", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["policy_id"], ["policy.id"]),
        sa.ForeignKeyConstraint(["renewal_id"], ["renewal.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_activity_activity_type"), "activity", ["activity_type"], unique=False)
    op.create_index(op.f("ix_activity_client_id"), "activity", ["client_id"], unique=False)
    op.create_index(op.f("ix_activity_created_by_id"), "activity", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_activity_policy_id"), "activity", ["policy_id"], unique=False)
    op.create_index(op.f("ix_activity_renewal_id"), "activity", ["renewal_id"], unique=False)

    # 4. Create PaymentRecord Table
    payment_method_enum = sa.Enum(
        "MPESA",
        "CHEQUE",
        "BANK_TRANSFER",
        "IPF",
        "CASH",
        name="paymentmethod",
    )
    payment_status_enum = sa.Enum(
        "ACTIVE",
        "REVERSED",
        name="paymentstatus",
    )
    op.create_table(
        "paymentrecord",
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("deleted_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("unallocated_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="KES"),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("payment_method", payment_method_enum, nullable=False),
        sa.Column("reference_number", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("payer_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("proof_document_id", sa.Uuid(), nullable=True),
        sa.Column("status", payment_status_enum, nullable=False),
        sa.Column("reversal_of_id", sa.Uuid(), nullable=True),
        sa.Column("reversal_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["proof_document_id"], ["document.id"]),
        sa.ForeignKeyConstraint(["reversal_of_id"], ["paymentrecord.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_paymentrecord_client_id"), "paymentrecord", ["client_id"], unique=False)
    op.create_index(op.f("ix_paymentrecord_deleted_at"), "paymentrecord", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_paymentrecord_deleted_by_id"), "paymentrecord", ["deleted_by_id"], unique=False)
    op.create_index(op.f("ix_paymentrecord_proof_document_id"), "paymentrecord", ["proof_document_id"], unique=False)
    op.create_index(op.f("ix_paymentrecord_reference_number"), "paymentrecord", ["reference_number"], unique=False)
    op.create_index(op.f("ix_paymentrecord_reversal_of_id"), "paymentrecord", ["reversal_of_id"], unique=False)
    op.create_index(op.f("ix_paymentrecord_status"), "paymentrecord", ["status"], unique=False)

    # 5. Create PaymentAllocation Table
    payment_allocation_status_enum = sa.Enum(
        "ACTIVE",
        "REVERSED",
        name="paymentallocationstatus",
    )
    op.create_table(
        "paymentallocation",
        sa.Column("payment_record_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("risk_note_id", sa.Uuid(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("status", payment_allocation_status_enum, nullable=False),
        sa.Column("reversal_of_id", sa.Uuid(), nullable=True),
        sa.Column("reversal_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("allocated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoice.id"]),
        sa.ForeignKeyConstraint(["payment_record_id"], ["paymentrecord.id"]),
        sa.ForeignKeyConstraint(["reversal_of_id"], ["paymentallocation.id"]),
        sa.ForeignKeyConstraint(["risk_note_id"], ["risknote.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_paymentallocation_invoice_id"), "paymentallocation", ["invoice_id"], unique=False)
    op.create_index(op.f("ix_paymentallocation_payment_record_id"), "paymentallocation", ["payment_record_id"], unique=False)
    op.create_index(op.f("ix_paymentallocation_reversal_of_id"), "paymentallocation", ["reversal_of_id"], unique=False)
    op.create_index(op.f("ix_paymentallocation_risk_note_id"), "paymentallocation", ["risk_note_id"], unique=False)
    op.create_index(op.f("ix_paymentallocation_status"), "paymentallocation", ["status"], unique=False)


def downgrade():
    op.drop_table("paymentallocation")
    op.drop_table("paymentrecord")
    op.drop_table("activity")
    op.drop_index("uq_policy_single_active_renewal", table_name="renewal")
    op.drop_table("renewal")
    op.drop_table("vehicle")
