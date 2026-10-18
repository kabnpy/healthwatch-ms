# Strategy: Unified Document Management System

## 1. Naming & Philosophy
- **Renaming**: `DocumentViewer` -> `DocumentViewer`.
- **Purpose**: A single UI component that handles BOTH "Generated Templates" (Invoices, Risk Notes) and "External Uploads" (Receipts, ID Scans, Logbooks).
- **Philosophy**: External-First for evidence. If a document is a "Receipt", we show the original scan. If it is an "Invoice", we render our system template.

## 2. Storage Architecture
- **Abstraction**: We will implement a `StorageProvider` interface in the backend.
- **Immediate Implementation**: Local filesystem storage (within the `backend/storage/` directory).
- **Future-Proofing**: The interface will allow swapping to S3 (Blob Storage) without changing the database logic.
- **File Paths**: DB will store relative paths: `receipts/2026/01/client_abc_rct_123.pdf`.

## 3. Document Identification (Tags vs. Type)
- **Primary Link**: `entity_type` (e.g., "Receipt") + `entity_id` (the Receipt ID) is the absolute link.
- **Classification**: `document_type` (e.g., "M-Pesa Screenshot", "Bank Slip") acts as the primary tag.
- **Searchability**: We will add a `metadata` JSONB field to the `Document` model to store searchable key-value pairs (e.g., `{"amount": 5000, "ref": "MPESA-X-123"}`).

## 4. Enhanced DocumentViewer Logic
- **Smart Rendering**:
    - If `document.mime_type` is `application/pdf` -> Render in PDF Viewer.
    - If `document.mime_type` is an image -> Render in Image Lightbox.
    - If `document` is a system entity (Risk Note/Invoice) -> Render React Template.
- **The "Contextual Sidebar"**: For Receipts, the viewer will show a sidebar containing the ledger data (Allocation History, Amount, Date) next to the scan.

## 5. Search & Filtering Workflow
- **Global Search**: Search by filename or the `metadata` JSONB field.
- **Contextual Filtering**: Inside a Client view, "Documents" tab will filter by `client_id` (via the linked entities).
- **Status Tracking**: Add a `status` field to Documents: `Pending Review`, `Verified`, `Rejected`.

## 6. Action Plan
1. **Refactor**: Rename `DocumentViewer` to `DocumentViewer` and simplify imports.
2. **Backend Storage**: Implement a basic `/api/v1/utils/upload` endpoint and a `LocalFileSystemProvider`.
3. **Receipt Workflow**:
    - Update `AddReceiptForm` to require a file upload.
    - The `DocumentViewer` will fetch and display this file when "View Receipt" is clicked.
4. **Metadata**: Add `metadata` field to the `Document` model to store details extracted during upload.
