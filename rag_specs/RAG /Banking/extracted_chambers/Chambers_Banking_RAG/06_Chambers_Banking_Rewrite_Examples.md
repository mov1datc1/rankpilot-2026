# Chambers Banking Rewrite Examples — RankPilot RAG v1

## Purpose

This document teaches RankPilot how to transform weak Banking matter descriptions into Chambers-ready narratives.

The goal is not to make matters sound inflated. The goal is to surface the ranking signals that are often hidden in technical or generic descriptions.

---

## Rewrite principle

A strong Chambers Banking matter should usually answer:

1. Who did the firm act for?
2. What type of financing was involved?
3. What was the value or significance?
4. What was structurally or legally complex?
5. What did the firm specifically do?
6. Why does the matter matter in the market?
7. Why does it belong in this Banking table?

---

## Example 1 — Generic loan

### Before

The firm advised Banco X on a loan agreement with Company Y.

### After

The firm represented Banco X as lender in the negotiation of a secured term loan facility granted to Company Y to support its regional expansion strategy. The team advised on the facility documentation, security package and conditions precedent, including collateral arrangements over key operating assets.

### Stronger version if facts allow

The firm represented Banco X as lead lender in a USD 120 million secured term loan facility granted to Company Y. The transaction involved collateral over receivables and operating assets in two jurisdictions, requiring the team to advise on enforceability, guarantor limitations and cross-border perfection requirements.

---

## Example 2 — Syndicated loan

### Before

The firm advised the banks on a syndicated loan.

### After

The firm advised the mandated lead arrangers in connection with a USD 350 million syndicated credit facility for a leading regional corporate borrower. The team led the negotiation of the facility agreement, coordinated lender comments and advised on security, agency and closing mechanics.

### Stronger version if facts allow

The firm acted as counsel to a syndicate of international and regional banks on a USD 350 million multi-currency syndicated facility for a leading regional corporate borrower. The matter required coordination across three jurisdictions, negotiation of a complex security package and advice on lender protections under local law.

---

## Example 3 — Acquisition finance

### Before

The firm advised on financing for an acquisition.

### After

The firm advised the borrower on the financing of its acquisition of Target Company, including the negotiation of a senior secured facility with a group of international lenders.

### Stronger version if facts allow

The firm represented a private equity sponsor in the financing of its acquisition of Target Company through a senior secured acquisition facility and revolving credit line. The team advised on debt structuring, covenant negotiation, conditions precedent and the alignment of financing terms with the acquisition documents.

---

## Example 4 — Leveraged finance

### Before

The firm advised a sponsor on a leveraged finance transaction.

### After

The firm advised a financial sponsor on the leveraged financing package supporting its acquisition of a regional healthcare platform. The transaction involved senior and mezzanine debt, intercreditor arrangements and extensive covenant negotiations.

### Stronger version if facts allow

The firm represented the financial sponsor in a USD 600 million leveraged acquisition financing involving a senior secured term loan, revolving credit facility and mezzanine tranche. The team advised on the debt structure, intercreditor agreement, covenant package and sponsor-side protections.

---

## Example 5 — Refinancing

### Before

The firm advised the company on a refinancing.

### After

The firm advised the borrower on the refinancing of its existing credit facilities, including the negotiation of amended repayment terms and revised security arrangements with its lender group.

### Stronger version if facts allow

The firm advised a distressed corporate borrower on the refinancing and restructuring of USD 250 million in existing debt. The matter involved standstill arrangements, covenant resets, new money financing and negotiations with secured lenders to preserve liquidity and avoid insolvency proceedings.

---

## Example 6 — Fund finance

### Before

The firm advised a fund on a subscription facility.

### After

The firm advised a private equity fund on a subscription line facility secured by investor capital commitments.

### Stronger version if facts allow

The firm advised a leading private equity fund on a USD 400 million subscription line facility involving capital commitments from investors across multiple jurisdictions. The team reviewed fund documentation, advised on borrowing limitations and negotiated lender protections relating to investor default and collateral enforcement.

---

## Example 7 — NAV facility

### Before

The firm advised on a NAV financing.

### After

The firm advised a credit fund on a NAV-based financing secured against a portfolio of fund assets.

### Stronger version if facts allow

The firm represented a global private credit fund in a NAV-based financing secured against a diversified portfolio of fund assets. The team advised on valuation mechanics, collateral structure, fund documentation constraints and lender protections, in a transaction combining fund finance and structured finance features.

---

## Example 8 — Sustainability-linked facility

### Before

The firm advised on an ESG loan.

### After

The firm advised the borrower on a sustainability-linked credit facility with pricing adjustments tied to ESG performance indicators.

### Stronger version if facts allow

The firm advised a listed corporate borrower on a USD 500 million sustainability-linked revolving credit facility provided by a syndicate of international banks. The team negotiated KPI-linked margin adjustment mechanics, reporting obligations and lender protections relating to ESG performance.

---

## Example 9 — Local counsel role

### Before

The firm acted as local counsel on a USD 1 billion financing.

### After

The firm acted as local counsel in connection with a USD 1 billion financing, advising on local law security, corporate authorisations and enforceability of guarantees.

### Stronger version if facts allow

The firm acted as local counsel in a USD 1 billion cross-border financing, advising the international lender syndicate on the creation and perfection of local security over operating assets, enforceability of upstream guarantees and regulatory approvals required for closing. The local law advice was central to the collateral package and transaction timetable.

---

## Example 10 — Trade finance

### Before

The firm advised on a trade finance facility.

### After

The firm advised a bank on a trade finance facility supporting the import of industrial equipment.

### Stronger version if facts allow

The firm advised an export credit agency and a syndicate of lenders on a USD 300 million ECA-backed trade finance facility supporting the export of industrial equipment for a transport infrastructure project. The matter involved ECA documentation, disbursement mechanics, security over receivables and public-sector approval requirements.

---

## Example 11 — Asset-based lending

### Before

The firm advised on an asset-based loan.

### After

The firm advised the lender on an asset-based revolving credit facility secured by borrower receivables and inventory.

### Stronger version if facts allow

The firm represented an international bank in a USD 180 million asset-based revolving facility secured by receivables, inventory and equipment across multiple operating subsidiaries. The team advised on borrowing base mechanics, collateral monitoring, guarantor limitations and enforcement risks.

---

## Example 12 — Wrong category warning

### Before

The firm advised on the issuance of corporate bonds.

### RankPilot response

This may be a strong matter, but it may not belong in Chambers Banking if the jurisdiction has a separate Capital Markets ranking. RankPilot should recommend moving it to Capital Markets unless the securities issuance was part of a broader bank financing package and the Banking component is central.

### Banking rewrite only if appropriate

The firm advised the borrower on the bank financing component of a broader refinancing package that also included a corporate bond issuance. The Banking narrative should focus only on the loan facility, lender negotiations, security package and bank financing structure.

---

## Rewrite rules for RankPilot

### Always strengthen specificity

Weak:

- advised on financing
- assisted with loan
- supported refinancing

Strong:

- represented the lender syndicate
- negotiated the secured facility
- structured the collateral package
- advised on cross-border enforceability
- led covenant negotiations

### Avoid unsupported adjectives

Weak:

- landmark
- complex
- innovative
- significant

Strong:

- first sustainability-linked facility in the sector
- involved collateral in four jurisdictions
- required negotiation with 12 lenders
- included senior, mezzanine and revolving tranches
- combined subscription line and NAV features

### Make role visible

Every rewritten matter should clarify:

- client side
- firm role
- strategic contribution
- legal issues handled

### Preserve truth

RankPilot must not invent:

- deal value
- jurisdictions
- client names
- lead counsel status
- innovation
- complexity

If facts are missing, RankPilot should mark them as questions.
