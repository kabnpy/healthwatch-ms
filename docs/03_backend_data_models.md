# Backend Data Models (Refined Architecture)

> **STATUS:** FINAL
> **CONTEXT:** Supports "Temporal Versioning" (History), Snapshots, and Financial Integrity.

---

## 1. CORE ENTITIES (Identity)

### `User`
- `id`: UUID.
- `email`: String (Unique).
- `full_name`: String.
- `role`: Enum (`Admin`, `Underwriter`, `Cashier`, `Viewer`).
- `is_active`: Boolean.

### `Client`
- `id`: UUID.
- `name`: String.
- `kra_pin`: String.
- `email`: String.
- `phone`: String.
- `postal_address`: Text.
- **`contacts`**: JSON (Multi-contact system for Corporate clients).

---

## 2. PRODUCT & POLICY ENGINE

### `Product` (The Template)
- `id`: UUID.
- `name`: String (e.g., "Gold Comprehensive").
- `class_of_insurance`: String (e.g., "Motor Private").
- `pricing_strategy`: Enum (`Percentage`, `FixedTiered`, `Manual`).
- `pricing_rules`: JSON.
- `form_schema`: JSON (Defines fields for the Wizard).

### `Policy` (The Folder)
- `id`: UUID.
- `client_id`: FK -> Client.
- `product_id`: FK -> Product.
- `policy_number`: String (Unique).
- `status`: Enum (`Active`, `Lapsed`, `Cancelled`).
- `created_at`: Timestamp.

### `RiskItem` (The Asset - Temporal)
*Multiple versions can exist for one asset over time.*
- `id`: UUID.
- `policy_id`: FK -> Policy.
- `version_number`: Int.
- `valid_from`: Date.
- `valid_to`: Date (Nullable).
- `is_active`: Boolean.
- `description`: String.
- `cover_description`: String.
- `total_premium`: Decimal.
- `premium_breakdown`: JSON.
- `risk_details`: JSON (Product-specific data).

### `RiskNote` (The Transaction Snapshot)
*A frozen state of the policy for a specific event (Renewal, Endorsement).*
- `id`: UUID.
- `policy_id`: FK -> Policy.
- `transaction_type`: Enum (`New Business`, `Renewal`, `Endorsement`, `Cancellation`).
- `previous_risk_note_id`: FK -> RiskNote.
- `created_by_id`: FK -> User.
- `start_date`: Date.
- `end_date`: Date.
- `items_snapshot`: JSON (Frozen state of all RiskItems in this transaction).
- `net_premium`: Decimal.
- `taxes`: JSON.
- `total_amount`: Decimal (The amount to be invoiced).

---

## 3. FINANCIALS (Ledge)

### `Invoice` (The Debt)
- `id`: UUID.
- `invoice_number`: String.
- `client_id`: FK -> Client.
- `date_issued`: Date.
- `status`: Enum (`Unpaid`, `Partial`, `Paid`).
- `total_amount`: Decimal.
- `balance_due`: Decimal.

### `Receipt` (The Money In)
- `id`: UUID.
- `receipt_number`: String.
- `client_id`: FK -> Client.
- `date_received`: Date.
- `amount`: Decimal.
- `unallocated_amount`: Decimal.
- `mode`: Enum (`MPESA`, `BankTransfer`, `Cash`, `Cheque`).
- `reference`: String.
- `status`: Enum (`Active`, `Voided`).

### `ReceiptAllocation` (The Link)
- `id`: UUID.
- `receipt_id`: FK -> Receipt.
- `invoice_id`: FK -> Invoice.
- `risk_note_id`: FK -> RiskNote (Optional).
- `amount_allocated`: Decimal.

---

## 4. CLAIMS & DOCUMENTS

### `Claim`
- `id`: UUID.
- `policy_id`: FK -> Policy.
- `risk_item_id`: FK -> RiskItem (Specific version).
- `claim_number`: String.
- `date_of_loss`: Date.
- `date_reported`: Date.
- `status`: Enum (`Reported`, `Investigating`, `Approved`, `Declined`, `Paid`).

### `Document` (Polymorphic)
*A single table for all file attachments across the system. This is where external files (e.g., Bank Slips, M-Pesa screenshots, Insurer-issued receipts) are stored and linked to internal records.*

- `id`: UUID.
- **`entity_type`**: Enum (`Client`, `Policy`, `Claim`, `RiskNote`, `Receipt`).
- **`entity_id`**: UUID (e.g., link to a specific internal Receipt record).
- `document_type`: String (e.g., "Logbook", "ID", "Proof of Payment", "Insurer Receipt").
- `file_path`: String (Local path or S3 Key).
- `uploaded_at`: Timestamp.

**Relationship Note:**
- An internal **Receipt** record represents the financial transaction in the ledger.
- An external **Proof of Payment** is a **Document** linked to that Receipt.
