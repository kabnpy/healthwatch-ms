# Strategy: Granular Postal Address Refinement

## Goal
Refine the address structure for Clients to be more granular, supporting standard Kenyan postal formats:
- **Postal Address**: e.g., "P.O. Box 123"
- **Postal Code**: e.g., "00100"
- **Town**: e.g., "Nairobi"

## 1. Backend Changes
- **Model Update**:
    - Update `ClientBase` in `backend/app/models/insurance/client.py` to include `postal_code` and `town`.
    - Update `ClientUpdate` to allow partial updates for these fields.
- **Database Migration**:
    - Generate an Alembic migration to add `postal_code` and `town` columns to the `client` table.
- **Seed Data**:
    - Update `backend/app/seed_mock_data.py` to use granular address fields.

## 2. Frontend Changes
- **API Client**:
    - Regenerate the frontend API client to reflect backend model changes.
- **Components**:
    - **ClientForm**: Update the form to include separate inputs for Address, Code, and Town.
    - **Client Overview**: Update `_layout/clients.$clientId.overview.tsx` to display the formatted postal address.
- **Templates**:
    - Update `RiskNoteTemplate` and `InvoiceTemplate` to render the address as: `[Postal Address] - [Postal Code], [Town]`.

## 3. Atomic Steps

### Phase 1: Backend & Database
- [x] **Step 1.1**: Update `backend/app/models/insurance/client.py`.
- [x] **Step 1.2**: Create and apply Alembic migration.
- [x] **Step 1.3**: Update `seed_mock_data.py` and re-seed the database.

### Phase 2: Frontend Integration
- [x] **Step 2.1**: Run `scripts/generate-client.sh`.
- [x] **Step 2.2**: Update `ClientForm.tsx` with Zod schema and UI fields.
- [x] **Step 2.3**: Update client views and document templates.

### Phase 3: Verification
- [x] **Step 3.1**: Verify client creation/edit with granular addresses.
- [x] **Step 3.2**: Verify document rendering (PDF/Print) displays addresses correctly.
