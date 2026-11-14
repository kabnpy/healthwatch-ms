import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Client,
    Insurer,
    Policy,
    PolicyStatus,
    Product,
    Renewal,
    RenewalStatus,
    RiskNote,
    TransactionType,
)


def _create_client_and_product(db: Session) -> tuple[Client, Product]:
    client = Client(
        name=f"DashClient-{uuid.uuid4().hex[:6]}",
        email=f"dash-client-{uuid.uuid4().hex[:6]}@example.com",
        phone="0700000000",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}Z",
    )
    db.add(client)

    insurer = Insurer(
        name=f"DashInsurer-{uuid.uuid4().hex[:6]}",
        email=f"dash-insurer-{uuid.uuid4().hex[:6]}@example.com",
    )
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name=f"DashProduct-{uuid.uuid4().hex[:6]}",
        class_of_insurance="Motor Private",
        default_commission_rate=Decimal("10.00"),
    )
    db.add(product)
    db.flush()
    return client, product


def test_dashboard_summary_counts_and_queues(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client, product = _create_client_and_product(db)
    today = date.today()

    expiring_policy = Policy(
        policy_number=f"POL-EXP-{uuid.uuid4().hex[:6].upper()}",
        client_id=db_client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
    )
    lapsed_policy = Policy(
        policy_number=f"POL-LAP-{uuid.uuid4().hex[:6].upper()}",
        client_id=db_client.id,
        product_id=product.id,
        status=PolicyStatus.LAPSED,
    )
    db.add(expiring_policy)
    db.add(lapsed_policy)
    db.flush()

    exp_note = RiskNote(
        policy_id=expiring_policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        coverage_start=today - timedelta(days=355),
        coverage_end=today + timedelta(days=10),
    )
    lap_note = RiskNote(
        policy_id=lapsed_policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        coverage_start=today - timedelta(days=400),
        coverage_end=today - timedelta(days=35),
    )
    db.add(exp_note)
    db.add(lap_note)
    db.flush()

    in_flight = Renewal(
        policy_id=expiring_policy.id,
        renewal_period_start=exp_note.coverage_end + timedelta(days=1),
        renewal_period_end=exp_note.coverage_end + timedelta(days=365),
        status=RenewalStatus.CLIENT_INVITED,
    )
    completed = Renewal(
        policy_id=lapsed_policy.id,
        renewal_period_start=lap_note.coverage_end + timedelta(days=1),
        renewal_period_end=lap_note.coverage_end + timedelta(days=365),
        status=RenewalStatus.COMPLETED,
    )
    db.add(in_flight)
    db.add(completed)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/dashboard/summary",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["active_count"] >= 1
    assert data["lapsed_count"] >= 1
    expiring_ids = [item["policy"]["id"] for item in data["expiring_30"]]
    assert str(expiring_policy.id) in expiring_ids
    matching_exp = next(
        item for item in data["expiring_30"] if item["policy"]["id"] == str(expiring_policy.id)
    )
    assert matching_exp["days_left"] == 10
    assert matching_exp["client_name"] == db_client.name

    in_flight_ids = [item["renewal"]["id"] for item in data["in_flight_renewals"]]
    assert str(in_flight.id) in in_flight_ids
    assert str(completed.id) not in in_flight_ids
    assert data["in_flight_renewals_count"] >= 1


def test_dashboard_summary_no_truncation_over_200_policies(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client, product = _create_client_and_product(db)
    today = date.today()

    # Create 205 active policies; the 205th is expiring in 5 days
    policies: list[Policy] = []
    for i in range(205):
        policies.append(
            Policy(
                policy_number=f"POL-BULK-{i:03d}-{uuid.uuid4().hex[:4].upper()}",
                client_id=db_client.id,
                product_id=product.id,
                status=PolicyStatus.ACTIVE,
            )
        )
    db.add_all(policies)
    db.flush()

    notes = [
        RiskNote(
            policy_id=p.id,
            transaction_type=TransactionType.NEW_BUSINESS,
            coverage_start=today - timedelta(days=180),
            coverage_end=today + timedelta(days=5) if idx == 204 else today + timedelta(days=180),
        )
        for idx, p in enumerate(policies)
    ]
    db.add_all(notes)
    db.commit()

    target_policy = policies[-1]

    response = client.get(
        f"{settings.API_V1_STR}/dashboard/summary",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["active_count"] >= 205
    expiring_ids = [item["policy"]["id"] for item in data["expiring_30"]]
    assert str(target_policy.id) in expiring_ids
