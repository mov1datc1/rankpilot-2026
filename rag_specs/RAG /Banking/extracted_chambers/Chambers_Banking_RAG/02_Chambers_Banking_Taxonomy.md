# Chambers Banking Taxonomy — RankPilot RAG v1

## Purpose

This document gives RankPilot the classification system it needs to understand Banking & Finance matters for Chambers.

The goal is to help the system identify what kind of banking work a matter involves, whether it belongs in Banking, and how sophisticated it is.

---

## 1. Core Banking & Finance matter types

### Acquisition Finance

Financing arranged to fund the acquisition of a company, asset, business line or portfolio.

Strong indicators:

- financing linked to M&A
- borrower or sponsor acquiring a target
- lender financing purchase price
- debt package negotiated alongside acquisition documentation

High-ranking signals:

- large acquisition value
- private equity sponsor involvement
- cross-border security
- multiple lenders
- bridge-to-bond or bank/bond structure
- complex intercreditor arrangements

### Leveraged Finance

Sub-investment grade lending, often linked to private equity, leveraged buyouts or highly leveraged corporate borrowers.

Strong indicators:

- LBO financing
- sponsor-backed borrower
- senior / mezzanine / unitranche debt
- direct lending
- high-yield bond crossover
- covenants and intercreditor mechanics

High-ranking signals:

- financial sponsor client
- lender syndicate
- complex debt stack
- large transaction value
- cross-border collateral
- refinancing of leveraged debt
- covenant negotiation

### Corporate Finance / Investment Grade Lending

Lending to investment grade or corporate borrowers.

Strong indicators:

- revolving credit facility
- term loan
- working capital facility
- corporate treasury financing
- syndicated loan
- refinancing of corporate debt

High-ranking signals:

- major corporate borrower
- major banks
- large syndicated facility
- sustainability-linked pricing
- public company borrower
- acquisition-related financing
- multi-currency or multi-jurisdiction structure

### Syndicated Lending

Loan provided by a group of lenders.

Strong indicators:

- mandated lead arrangers
- bookrunners
- agent bank
- multiple lender syndicate
- facility agreement
- security agent

High-ranking signals:

- large lender group
- international syndicate
- complex allocation
- multi-currency facility
- security package
- market-leading borrower or sponsor

### Structured Finance

Financing involving more complex structures than plain lending.

Strong indicators:

- securitisation-style mechanics
- receivables financing
- risk transfer
- structured notes
- repackaging
- hybrid instruments
- bespoke collateral or payment waterfall

High-ranking signals:

- novel structure
- complex asset pool
- regulatory overlay
- cross-border SPV
- tax-sensitive structuring
- first-of-kind transaction

### Asset-based Lending

Loans secured by borrower assets.

Collateral may include:

- accounts receivable
- inventory
- equipment
- real estate
- receivables portfolios

High-ranking signals:

- complex collateral pool
- multiple jurisdictions
- asset valuation issues
- distressed context
- revolving borrowing base
- lender-side representation

### Fund Finance

Financing at fund level.

Common products:

- subscription line facility
- capital call facility
- NAV facility
- hybrid facility
- continuation fund financing
- GP financing
- co-investment vehicle financing
- rated note structure

High-ranking signals:

- major private equity, credit, real estate or infrastructure fund
- complex fund structure
- umbrella vehicle
- levered feeder structure
- lender-side sophistication
- cross-border investor base
- NAV complexity

### Trade Finance

Financing used to support trade flows.

Includes:

- commodity finance
- export finance
- import finance
- supply chain finance
- factoring
- receivables finance
- ECA-backed finance
- structured trade finance

High-ranking signals:

- large trading house
- export credit agency
- cross-border payment risk
- commodities
- complex security over goods or receivables
- emerging markets angle

### Real Estate Finance

Financing of acquisition, development or investment in real estate.

High-ranking signals:

- large development finance
- portfolio acquisition finance
- cross-border lender group
- institutional real estate investors
- complex security
- major refinancing with strategic significance

### Project Finance

Financing linked to the future income or success of a project.

Sectors:

- energy
- renewables
- infrastructure
- transport
- telecoms
- mining
- oil and gas
- utilities
- social infrastructure

Important Chambers rule:

If a separate Project Finance table exists, these matters usually belong there rather than in Banking.

### Refinancing

Replacement or restructuring of existing debt.

High-ranking signals:

- distressed borrower
- complex lender negotiations
- multiple debt instruments
- maturity extension
- covenant reset
- cross-border collateral
- rescue financing
- debtor-in-possession financing

### Debt Restructuring / Distressed Finance

Reworking of distressed debt arrangements.

May belong in Banking only where no separate Restructuring/Insolvency table exists.

High-ranking signals:

- distressed asset
- creditor committee
- debtor-in-possession financing
- insolvency context
- multi-creditor negotiation
- rescue package
- standstill agreement

### Islamic Finance

Sharia-compliant finance.

Structures include:

- Ijarah
- Istisna’a
- Murabaha
- Musharaka
- Sukuk
- Tawarruq
- Wakalah

High-ranking signals:

- complex Sharia structure
- cross-border Islamic finance
- real estate / acquisition / capital markets crossover
- major Islamic bank or sovereign client

---

## 2. Adjacent categories

RankPilot must check whether the matter belongs in a different Chambers table.

### Capital Markets

Likely belongs outside Banking if the core work is:

- IPO
- equity offering
- bond issuance
- high-yield bond
- MTN programme
- securitisation
- CLO
- derivatives
- structured products

### Asset Finance

Likely belongs outside general Banking if financing is tied to:

- aircraft
- ships
- rolling stock
- sale and leaseback
- operating leases
- JOLCOs
- ECA aircraft financing
- shipping finance
- rail finance

### Financial Services Regulatory

Likely belongs outside transactional Banking if focused on:

- regulatory compliance
- financial services directives
- bank licensing
- fintech regulation
- prudential regulation
- fund formation in regulatory context

### Banking Litigation

Likely belongs outside Banking if focused on disputes involving:

- mis-selling
- professional negligence
- bank failures
- civil fraud
- breaches of warranty
- commercial banking claims

---

## 3. Role taxonomy

RankPilot must classify firm role.

### Very strong roles

- lead counsel
- lender counsel
- sponsor counsel
- borrower counsel on strategic financing
- coordinating counsel
- structuring counsel
- agent counsel
- security agent counsel

### Moderate roles

- local counsel with substantive responsibility
- regulatory counsel with strategic input
- counsel on one financing tranche
- counsel on collateral or security aspects

### Weak roles unless explained

- local counsel only
- due diligence support
- document review
- limited legal opinion
- ancillary advice
- routine regulatory input

---

## 4. Complexity indicators

RankPilot should detect and reward:

- multi-tranche structure
- cross-border collateral
- intercreditor arrangements
- syndicated lender group
- multiple currencies
- security package
- regulatory constraints
- tax-driven structuring
- financial sponsor involvement
- alternative lender / private credit involvement
- sustainability-linked features
- NAV or hybrid fund finance
- ECA involvement
- mezzanine layer
- bridge financing
- distressed context
- covenant renegotiation
- first-of-kind structure
- novel market product

---

## 5. Weakness indicators

RankPilot should flag:

- “loan agreement” with no additional detail
- bilateral lending with no special features
- refinancing with no stated complexity
- no deal value
- no client significance
- no explanation of firm role
- no jurisdictional complexity
- generic “advised client” wording
- unclear whether matter belongs in Banking
- matter better suited to Capital Markets, Project Finance, Asset Finance, Restructuring or Financial Services Regulatory

---

## 6. Matter classification template

For each matter, RankPilot should classify:

- Primary category:
- Secondary category:
- Adjacent table risk:
- Client side:
- Firm role:
- Deal value:
- Jurisdictions:
- Complexity indicators:
- Market significance:
- Chambers fit:
- Recommended action:
