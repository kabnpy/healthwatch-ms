from fastapi import APIRouter

from app.api.routes import (
    activities,
    calculations,
    claims,
    clients,
    commissions,
    document_jobs,
    documents,
    financials,
    insurers,
    invoice_batches,
    ipf,
    login,
    payments,
    policies,
    private,
    products,
    rate_tables,
    renewals,
    risk_notes,
    statements,
    users,
    utils,
    vehicles,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(insurers.router, prefix="/insurers", tags=["insurers"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(policies.router, prefix="/policies", tags=["policies"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(risk_notes.router, prefix="/risk-notes", tags=["risk-notes"])
api_router.include_router(financials.router, prefix="/financials", tags=["financials"])
api_router.include_router(
    payments.payment_records_router,
    prefix="/payment-records",
    tags=["payment-records"],
)
api_router.include_router(
    payments.payment_allocations_router,
    prefix="/payment-allocations",
    tags=["payment-allocations"],
)
api_router.include_router(claims.router, prefix="/claims", tags=["claims"])
api_router.include_router(renewals.router, prefix="/renewals", tags=["renewals"])
api_router.include_router(activities.router, prefix="/activities", tags=["activities"])
api_router.include_router(
    rate_tables.router, prefix="/rate-tables", tags=["rate-tables"]
)
api_router.include_router(
    calculations.router, prefix="/calculations", tags=["calculations"]
)
api_router.include_router(ipf.router, prefix="/ipf", tags=["ipf"])
api_router.include_router(
    commissions.router, prefix="/commissions", tags=["commissions"]
)
api_router.include_router(statements.router, prefix="/statements", tags=["statements"])
api_router.include_router(
    invoice_batches.router, prefix="/invoice-batches", tags=["invoice-batches"]
)
api_router.include_router(
    document_jobs.router, prefix="/document-jobs", tags=["document-jobs"]
)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
