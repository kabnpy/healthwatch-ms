"""
Seeds package orchestrator for HealthWatch MS.
Coordinates idempotent seeding across underwriters, products, clients, policies, renewals, and financials.
"""

import logging
from typing import Any

from sqlmodel import Session

from app.core.db import engine
from app.seeds.activities_data import seed_activities
from app.seeds.carriers_and_products import seed_insurers_and_products
from app.seeds.clients_data import seed_clients
from app.seeds.financials_data import seed_financials
from app.seeds.portfolios_data import seed_portfolios_and_assets
from app.seeds.renewals_data import seed_renewals

logger = logging.getLogger(__name__)


def seed_all_data(session: Session | None = None) -> dict[str, Any]:
    """
    Execute full portfolio seed idempotently.
    Accepts an existing Session or binds to application engine.
    """
    if session is not None:
        return _run_seed_pipeline(session)

    with Session(engine) as new_session:
        return _run_seed_pipeline(new_session)


def _run_seed_pipeline(session: Session) -> dict[str, Any]:
    logger.info("Executing Phase 1: Underwriting Carriers & Products...")
    ref_data = seed_insurers_and_products(session)
    insurers = ref_data["insurers"]
    products = ref_data["products"]

    logger.info("Executing Phase 2: Client Directory (Individuals, HNW, Corporate)...")
    clients = seed_clients(session)

    logger.info("Executing Phase 3: Contract Portfolios, Vehicles & Cover Snapshots...")
    policies = seed_portfolios_and_assets(
        session=session,
        _insurers=insurers,
        products=products,
        clients=clients,
    )

    logger.info("Executing Phase 4: Renewal Workflow Pipeline (6 Stages)...")
    renewals = seed_renewals(
        session=session,
        policies=policies,
    )

    logger.info(
        "Executing Phase 5: Financials, Cleared Payments & Ledger Allocations..."
    )
    financials = seed_financials(
        session=session,
        clients=clients,
        policies=policies,
    )

    logger.info("Executing Phase 6: Operational Activity Timeline...")
    activities = seed_activities(
        session=session,
        clients=clients,
        policies=policies,
        renewals=renewals,
    )

    logger.info("Portfolio Seed Pipeline Completed Successfully.")
    return {
        "insurers_count": len(insurers),
        "products_count": len(products),
        "clients_count": len(clients),
        "policies_count": len(policies),
        "renewals_count": len(renewals),
        "invoices_count": len(financials["invoices"]),
        "payments_count": len(financials["payments"]),
        "activities_count": len(activities),
    }
