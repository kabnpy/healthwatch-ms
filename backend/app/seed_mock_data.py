"""
Master Seed Script for HealthWatch MS.
Orchestrates idempotent seeding across underwriters, products, clients, policies, renewals, and financials.
"""

import logging

from sqlmodel import Session

from app.seeds import seed_all_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_mock_data(session: Session | None = None) -> None:
    """
    Entrypoint to seed full insurance agency portfolio with near real-world data.
    Can be called with an active Session or creates one using engine.
    """
    logger.info("Initializing HealthWatch MS Seed Data Pipeline...")
    summary = seed_all_data(session=session)
    logger.info(
        "HealthWatch MS Seed Data Completed: "
        f"{summary['insurers_count']} insurers, "
        f"{summary['products_count']} products, "
        f"{summary['clients_count']} clients, "
        f"{summary['policies_count']} policies, "
        f"{summary['renewals_count']} renewals, "
        f"{summary['invoices_count']} invoices, "
        f"{summary['payments_count']} payments, "
        f"{summary['activities_count']} activities."
    )


if __name__ == "__main__":
    create_mock_data()
