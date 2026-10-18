# Implementation Plan: Streamline New Policy Wizard

## Phase 1: Identity & Structure Refactor [checkpoint: dc45eae]
*   **Goal:** Consolidate product selection and introduce the manual policy number field.
*   - [x] Task: Update `NewPolicyWizard` state type to include a mandatory `policyNumber` field. d1dc73a
*   - [x] Task: Refactor `StepAsset` (Step 1) to include the "Policy Number" input field with professional copy. dc45eae
*   - [x] Task: Update wizard navigation logic to skip the "Terms" step entirely. dc45eae
*   - [x] Task: Conductor - User Manual Verification 'Identity & Structure' (Protocol in workflow.md) dc45eae

## Phase 2: Core Data Simplification [checkpoint: 9d0cbb8]
*   **Goal:** Streamline the risk detail and financial capture steps.
*   - [x] Task: Update `StepBlueprint` (Step 2) to display only Registration Number, Make, and Year of Manufacture. dc45eae
*   - [x] Task: Update `StepFinancials` (Step 3) to focus on Sum Insured and Period of Cover. dc45eae
*   - [x] Task: Remove `StepTerms` component and all references to it within the wizard. 9d0cbb8
*   - [x] Task: Conductor - User Manual Verification 'Core Data Simplification' (Protocol in workflow.md) 9d0cbb8

## Phase 3: Submission & Copy Overhaul [checkpoint: 6804e75]
*   **Goal:** Finalize submission logic and apply professional tone across the wizard.
*   - [x] Task: Update `handleIssuePolicy` in `NewPolicyWizard` to correctly map the custom `policyNumber` to the backend request. acdb7a2
*   - [x] Task: Refactor `StepReview` to show a clean summary of the simplified data. 6804e75
*   - [x] Task: Perform a comprehensive copy audit and update all wizard labels/placeholders to "Professional & Minimal" tone. 6804e75
*   - [x] Task: Conductor - User Manual Verification 'Submission & Polish' (Protocol in workflow.md) 6804e75

## Phase: Review Fixes
- [x] Task: Apply review suggestions 9348c23
