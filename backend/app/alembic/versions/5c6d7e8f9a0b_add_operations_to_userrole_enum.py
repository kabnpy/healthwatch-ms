"""Sync missing PostgreSQL enum values with SQLModel models

Revision ID: 5c6d7e8f9a0b
Revises: 4b5c6d7e8f9a
Create Date: 2026-10-19 05:55:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "5c6d7e8f9a0b"
down_revision = "4b5c6d7e8f9a"
branch_labels = None
depends_on = None

ENUM_UPDATES = {
    "activitytype": ["CALL"],
    "businessevent": ["COVER_CHANGE"],
    "claimstatus": [
        "ADJUSTER_APPOINTED",
        "DISCHARGE_VOUCHER",
        "DECLINED",
        "INTIMATED",
        "SETTLED",
        "REPAIRS_AUTHORIZED",
        "DOCUMENTS_PENDING",
    ],
    "documententitytype": ["RENEWAL", "PAYMENT"],
    "documentjobresourcetype": ["STATEMENT", "INVOICE_BATCH"],
    "documentjobstatus": ["SUCCEEDED"],
    "documenttype": [
        "CERTIFICATE_OF_INCORPORATION",
        "INSURER_RECEIPT",
        "CLAIM_FORM",
        "NATIONAL_ID_PASSPORT",
        "UTILITY_BILL",
        "POLICY_SCHEDULE",
        "VALUATION_REPORT",
        "BANK_SLIP",
        "PROOF_OF_PAYMENT",
        "KRA_PIN_CERTIFICATE",
        "COVER_NOTE",
        "CARRIER_RENEWAL_NOTICE",
        "POLICE_REPORT",
        "REPAIR_ESTIMATE",
        "ACCIDENT_PHOTOS",
        "MPESA_SCREENSHOT",
        "KYC_DOCUMENT",
    ],
    "ipfstatus": ["CANCELLED", "GUARANTEED"],
    "pricingmethod": ["PACKAGED", "FIXED_TIER", "MULTI_COMPONENT", "WAGE_ROLL"],
    "productline": [
        "FIRE",
        "GOLFERS",
        "MOTOR_COMPREHENSIVE",
        "MEDICAL",
        "PERSONAL_ACCIDENT",
        "MOTOR_THIRD_PARTY",
        "ALL_RISKS",
    ],
    "ratetablestatus": ["PUBLISHED", "RETIRED"],
    "risknotestatus": ["ACTIVE"],
    "userrole": ["OPERATIONS"],
}


def upgrade():
    for enum_type, vals in ENUM_UPDATES.items():
        for v in vals:
            op.execute(f"ALTER TYPE {enum_type} ADD VALUE IF NOT EXISTS '{v}'")


def downgrade():
    # PostgreSQL does not natively support removing values from an enum type.
    pass
