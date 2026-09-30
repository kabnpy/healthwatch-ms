# Strategy: Document Viewer Scaling & Modal Refinement

## Objective
Improve the usability of the document viewer by expanding modal dimensions and implementing a "Fit-to-Width" scaling mechanism, ensuring that documents (Invoices, Risk Notes) are fully visible and readable on all screen sizes, including mobile.

---

## Step 1: Audit Modal Widths
- [x] **Task**: Identify all `DialogContent` instances across the project that feel constrained.
- [x] **Action**: Search for `DialogContent` and check for `sm:max-w-lg` or missing width overrides.
- [x] **Verifiable Outcome**: A list of components to be updated (e.g., DocumentViewer, Wizards, Detail Modals).

## Step 2: Expand Document Viewer Modal Layout
- [x] **Task**: Modify the `DocumentViewerModal` to maximize available screen real estate.
- [x] **Action**:
    - Update `frontend/src/components/Common/DocumentViewerModal.tsx`.
    - Replace restrictive width classes with `sm:max-w-[95vw]` and `max-h-[95vh]`.
    - Add a `max-w-7xl` (or similar) cap for ultra-wide monitors to maintain readability.
- [x] **Verifiable Outcome**: The modal occupies the majority of the viewport width when opened.

## Step 3: Implement Responsive Document Scaling
- [x] **Task**: Create a scaling mechanism that mimics a PDF viewer's "Fit to Width" behavior.
- [x] **Action**:
    - Implement a `ResizeObserver` in `DocumentViewerModal` to monitor the width of the document container area.
    - Calculate a `scaleFactor`: `Math.min(1, containerWidth / 794)` (where 794px is the ~210mm A4 width).
    - Apply `transform: scale(scaleFactor)` and `transform-origin: top center` to the document wrapper.
    - **Critical**: Adjust the parent container's height to match the scaled height (e.g., `height: 297mm * scaleFactor`) to ensure scrollbars work correctly.
- [x] **Verifiable Outcome**: The document shrinks proportionally on small screens instead of overflowing or being clipped.

## Step 4: Refine Invoice View Scaling
- [x] **Task**: Ensure the `InvoiceTemplate` and `BaseDocument` work seamlessly with the scaling.
- [x] **Action**:
    - Remove any conflicting `overflow-auto` or hardcoded widths in `BaseDocument.tsx` that might fight the modal's scaling logic.
    - Ensure `InvoiceTemplate` content wraps correctly if needed (though scaling should handle most cases).
- [x] **Verifiable Outcome**: Invoices look like "mini-PDFs" on mobile devices, maintaining their layout integrity.

## Step 5: Standardize General Modal Sizing
- [x] **Task**: Apply learned sizing patterns to other "cramped" modals identified in Step 1.
- [x] **Action**: Create a set of standard "size" classes or a helper component to consistently apply `max-w-4xl` or `max-w-5xl` to complex forms/wizards.
- [x] **Verifiable Outcome**: UI consistency across the application for all modal-based interactions.

## Step 6: Verification & Print Test
- [x] **Task**: Confirm that visual scaling does not break printing.
- [x] **Action**:
    - Use the "Print" button in the modal.
    - Verify that the print CSS (already using `print:w-full`) correctly ignores the visual scale factor.
- [x] **Verifiable Outcome**: Physical printouts/PDF exports remain standard A4 size regardless of screen scaling.
