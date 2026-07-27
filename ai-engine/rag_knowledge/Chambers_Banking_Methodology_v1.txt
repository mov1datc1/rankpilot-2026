# Chambers Banking Methodology — RankPilot RAG v1

## Purpose

This document defines how RankPilot should understand and apply Chambers methodology for Banking & Finance-related submissions.

RankPilot must not treat “Banking & Finance” as a generic transactional category. Chambers applies different scopes depending on jurisdiction, table structure, and whether separate rankings exist for Capital Markets, Project Finance, Restructuring, Financial Services Regulatory, Asset Finance or related areas.

## Core principle

RankPilot must evaluate Banking matters through the lens of:

- jurisdiction
- exact Chambers table
- borrower / lender / sponsor side
- transaction type
- deal value
- complexity
- role of the firm
- market significance
- ranking objective
- adjacent categories that may be more appropriate

A matter should not be assessed as “strong” or “weak” until RankPilot determines whether it belongs in the relevant Banking table.

---

## 1. Chambers Banking & Finance — General Scope

Where Chambers uses a broad Banking & Finance definition, the category usually includes:

- acquisition finance
- general bank lending
- syndicated lending
- structured finance
- leveraged finance
- non-performing loans
- project finance, where no separate project finance table exists
- refinancing
- restructuring of existing loans
- debtor-in-possession financing
- Islamic finance
- borrower-side and lender-side mandates

## 2. London-specific structure

For London, Chambers has updated finance coverage and now distinguishes between:

### Corporate Finance

Recognises firms advising on corporate or investment grade lending.

Segmentation:

- borrower-side
- lender-side
- big-ticket
- mid-market

Indicative threshold:

- deals above GBP 500 million are usually considered Big-Ticket, depending on market conditions.

### Leveraged Finance

Recognises firms advising on leveraged or sub-investment grade lending.

Segmentation:

- financial sponsors / borrower-side
- lender-side
- big-ticket
- mid-market

Important rule:

Leveraged transactions involving corporate borrowers should be submitted under Leveraged Finance, not Corporate Finance.

### Asset-based Lending

Covers advice on loans secured against assets such as:

- accounts receivable
- inventory
- equipment
- real estate

Relevant clients include:

- lenders
- borrowers
- collateral agents
- guarantors
- equity sponsors

### Fund Finance

Covers representation of fund borrowers and lenders on:

- subscription facilities
- asset-based facilities
- NAV facilities
- hybrid facilities
- other fund-level financing structures

### Banking & Finance outside London

Outside London, Chambers continues to rank broader general banking and finance expertise.

---

## 3. Spain-specific Banking & Finance guidance

Spain Banking & Finance is broader than some other markets, but it excludes Project Finance and Restructuring/Insolvency where separate tables exist.

Included:

- acquisition finance
- lender-side finance
- general bank lending
- syndicated lending
- structured finance
- leveraged finance
- NPLs
- Islamic finance
- refinancing
- debtor-in-possession financing

Excluded:

- project finance
- restructuring / insolvency matters

These must be submitted to separate tables.

### Banking & Finance: Borrowers — Spain

A sub-table covering matters where firms act for:

- corporates
- financial sponsors
- public-sector entities

Relevant work includes:

- acquisition finance
- leveraged finance
- corporate loans
- syndicated loans
- refinancings
- asset-based finance
- trade finance
- sustainability-linked finance

---

## 4. Global / Latin America-related Chambers guidance

For Global Banking & Finance, Chambers distinguishes between Banking and Finance.

### Banking

Includes regulatory banking work for public and private financial institutions.

### Finance

Includes:

- corporate finance
- acquisition finance
- leveraged finance
- asset finance
- project finance
- secured loans
- unsecured loans
- bilateral loans
- syndicated loans
- structured finance
- general bank lending
- interbank lending
- refinancing
- restructuring of existing loans
- debtor-in-possession financing

Important Chambers signal:

Clear preference is given to lawyers and firms representing lenders / financial institutions.

### Capital markets overlap

If the jurisdiction has no separate Capital Markets ranking, securities-related transactions may be relevant to Banking & Finance.

If a separate Capital Markets section exists, IPOs, debt offerings and other securities transactions should not be included in Banking & Finance.

---

## 5. International Counsel — Banking & Finance

This category identifies lawyers advising on laws outside Latin America as they apply to Latin America-related matters.

Relevant:

- corporate finance
- asset finance
- acquisition finance
- leveraged finance through bank loans
- secured lending
- unsecured lending
- bilateral lending
- syndicated lending
- interbank lending
- refinancing
- debtor-in-possession financing
- bank M&A
- banking regulatory advice concerning interaction with regulators outside Latin America

Excluded:

- project finance

Project finance must be reported only in Project Finance, regardless of financing mechanism.

---

## 6. Related and adjacent Chambers sections

RankPilot must detect when a matter may belong elsewhere.

### Asset Finance

Covers finance linked to the purchase or construction of a distinct asset or set of assets, typically:

- aircraft
- ships
- rolling stock

Subtables may include:

- Aviation Finance
- Rail Finance
- Shipping Finance

### Capital Markets

Covers fundraising through securities and capital markets instruments:

- equity offerings
- debt issuances
- high-yield bonds
- derivatives
- securitisation
- structured products
- CLOs

If a matter is primarily an issuance of securities, RankPilot should test whether it belongs in Capital Markets rather than Banking.

### Project Finance

Covers financing of infrastructure, energy and industrial projects.

If the jurisdiction has a separate Project Finance table, project finance should normally not be treated as Banking.

### Restructuring & Insolvency

Covers insolvency, bankruptcy and restructuring of distressed assets.

However, where no dedicated Restructuring / Insolvency section exists, distressed restructuring work may be considered under Banking & Finance.

### Financial Services Regulatory

Covers regulatory matters in financial services, including:

- implementation of directives
- national legislation
- fintech regulatory aspects
- general regulatory advice

### Banking Litigation

Covers litigation related to commercial banking activities, including:

- mis-selling of financial products
- professional negligence
- breach of warranty
- civil fraud
- bank failures
- state bailouts

---

## 7. Chambers Banking ranking signals

RankPilot should treat the following as positive ranking signals:

### High-value finance

Especially where the value is significant for the market or table.

### Structural sophistication

Examples:

- multi-tranche facilities
- cross-border security packages
- intercreditor dynamics
- leveraged finance structures
- NAV or hybrid fund finance
- complex collateral arrangements
- structured finance components

### Strong role of the firm

Higher value:

- lead counsel
- lender counsel on major financings
- borrower/sponsor counsel on strategic transactions
- structuring role
- negotiation lead
- coordination of multiple jurisdictions

Lower value:

- local counsel only
- document review
- limited regulatory memo
- ancillary support role

### Client prestige

Stronger clients include:

- major banks
- international financial institutions
- private equity sponsors
- sovereigns
- development finance institutions
- major corporates
- funds
- export credit agencies

### Cross-border relevance

Especially where the firm coordinates across jurisdictions or handles foreign-law, security, regulatory or enforcement issues.

### Market impact

The matter should show why it matters beyond routine execution:

- first-of-kind structure
- large market transaction
- strategically important client
- financing linked to major M&A
- financing linked to infrastructure or sector transformation
- innovative ESG or sustainability-linked features

---

## 8. Negative ranking signals

RankPilot should flag:

- vanilla bilateral loans with no stated complexity
- small-ticket financings without strategic significance
- repeated refinancing work with no special features
- execution-only roles
- local counsel roles with no explanation of importance
- matters submitted in the wrong table
- project finance included in Banking where separate Project Finance exists
- capital markets work included in Banking where separate Capital Markets exists
- vague language such as “advised on financing” without structure, role or impact

---

## 9. RankPilot instruction

When analysing a Banking submission for Chambers, RankPilot must first answer:

1. What is the exact Chambers table?
2. Does this matter belong in this table?
3. Is the firm acting for lender, borrower, sponsor or another party?
4. What is the role of the firm?
5. What is the transaction type?
6. What is the deal value or market significance?
7. What is structurally sophisticated?
8. What is cross-border or jurisdictionally complex?
9. What ranking signal does this matter send?
10. What should be rewritten, moved or omitted?

RankPilot must not issue a final diagnosis without this classification.
