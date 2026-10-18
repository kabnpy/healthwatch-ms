# Specification: Centralized Rating Engine & Financial Hardening

## 1. Overview
This track centralizes all insurance premium calculations into a dedicated backend service. It establishes an authoritative "Rating Engine" that the frontend must query for quotes, ensuring data integrity and financial precision. It also improves auditability by storing a detailed, validated breakdown of all costs and selected benefits within the Risk Note.

## 2. Functional Requirements

### 2.1 Backend: Dedicated Rating Service
- **Architecture:** Create `app/services/rating.py`.
- **Pattern:** Implement the **Strategy Pattern**. The service will act as a dispatcher calling specific logic for `MotorPrivateRatingStrategy`, `DomesticRatingStrategy`, etc.
- **Authoritative Math:** All premium math (Net Premium, Training Levy, PHCF, Stamp Duty, and Commissions) is moved here from the frontend and models.
- **Quote Endpoint:** Create a `POST /api/v1/policies/quote` endpoint that returns a non-persistent financial breakdown based on input risk details.

### 2.2 Data Persistence & Validation
- **Schema Update:** Rename the `taxes` JSON field in the `RiskNote` model to `financial_breakdown`.
- **Polymorphic Validation:**
    - Create a `BaseFinancialBreakdown` Pydantic model for universal fields (totals, standard Kenyan levies).
    - Create specialized sub-models (e.g., `MotorFinancialBreakdown`) that extend the base with specific benefit line-items.
    - Use Pydantic's `RootModel` or `Annotated[Union[...], Discriminator(...)]` to ensure the correct validation logic is applied based on the product class.
- **Migration:** Provide an Alembic migration to rename the column and transform existing `taxes` data.

### 2.3 Frontend Integration
- **Real-time Pricing:** Update the "New Policy Wizard" to call the backend `/quote` endpoint when risk details change (debounced).
- **Benefit Display:** The "Review" step and the "Risk Note PDF" will now pull the benefit list and cost breakdown directly from the `financial_breakdown` stored in the backend.

## 3. Non-Functional Requirements
- **Precision:** Use Python's `Decimal` type for all calculations to prevent floating-point errors.
- **Auditability:** Ensure every Risk Note captures exactly what benefits were selected and how the final price was derived.

## 4. Acceptance Criteria
- [ ] Backend tests verify that `RatingService` returns identical results for known inputs.
- [ ] The `RiskNote` database table uses the `financial_breakdown` field.
- [ ] Policy creation fails if the input data doesn't pass the Pydantic validation for the financial breakdown.
- [ ] Frontend Wizard displays live prices fetched from the backend without local math.
- [ ] Generated PDF Risk Notes display a detailed breakdown including specific levies and benefits.

## 5. Out of Scope
- Redesigning the PDF layout (focus is on data injection).
- Product Versioning (reserved for the next track).
