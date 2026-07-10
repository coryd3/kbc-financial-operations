# Financial Operations View

Status: Draft - Needs Bylaw Review

## Purpose

This diagram gives a quick, durable view of how KBC financial accountability, day-to-day recordkeeping, committee oversight, personnel work, and congregational authority should relate to one another.

It describes functions rather than a particular person. Names, temporary assignments, and transition-specific decisions belong in project records rather than this governance view.

!!! note "Congregation Final Authority"
    The congregation remains the final authority where KBC bylaws, the annual budget, policy, officer election, major non-budgeted spending, or church practice require a vote.

## Financial Governance And Operations

```mermaid
%%{init: {"htmlLabels": false, "flowchart": {"curve": "basis", "nodeSpacing": 48, "rankSpacing": 65, "padding": 20, "wrappingWidth": 220}}}%%
flowchart TB
    Congregation["Congregation<br/>Final authority where<br/>a vote is required"]
    Nominating["Nominating Committee<br/>Officer recommendations"]
    Treasurer["Treasurer / Financial Officer<br/>Accountability and reporting"]
    Finance["Finance Committee<br/>Policy, budget, controls,<br/>and review"]
    Personnel["Personnel Committee<br/>Hiring and evaluation process"]
    Bookkeeper["Bookkeeper /<br/>Financial Administrator<br/>Records and reports"]
    PastorDeacons["Pastor and Deacons<br/>Counsel, communication,<br/>and recommendations"]
    Vendor["Outside Vendor<br/>Payroll, tax, and<br/>accounting support"]

    Congregation --> Nominating
    Nominating --> Treasurer
    Congregation --> Finance
    Congregation --> Personnel
    Congregation --> PastorDeacons

    Finance <--> Treasurer
    Finance -. duties and controls .-> Bookkeeper
    Personnel -. employment process .-> Bookkeeper
    Bookkeeper -. records and reports .-> Treasurer
    Bookkeeper -. monthly review packet .-> Finance
    Finance -. approved scope .-> Vendor
    Treasurer -. coordinates if assigned .-> Vendor
    PastorDeacons -. counsel .-> Finance
    PastorDeacons -. counsel .-> Personnel

    classDef authority fill:#e8f1ff,stroke:#2f5f98,color:#102033,stroke-width:1px;
    classDef committee fill:#eef8f3,stroke:#2f7d5b,color:#10291f,stroke-width:1px;
    classDef operations fill:#fff6df,stroke:#a76f00,color:#2d2100,stroke-width:1px;
    classDef support fill:#f3f6f8,stroke:#6b7280,color:#172033,stroke-width:1px;
    classDef vendor fill:#f6efff,stroke:#7551a6,color:#241633,stroke-width:1px;
    class Congregation authority;
    class Nominating,Finance,Personnel committee;
    class Treasurer,Bookkeeper operations;
    class PastorDeacons support;
    class Vendor vendor;
```

## Control Principles

- No one person should prepare, approve, record, reconcile, and report the same financial activity without review.
- Finance Committee defines financial controls and reviews the results.
- The Treasurer coordinates accountability and reporting as an elected officer.
- The Bookkeeper maintains day-to-day records within approved duties and controls.
- Personnel Committee manages employment matters but does not set financial-control policy.
- Pastor and Deacons may counsel and raise concerns through the proper church process.
- Matters reserved for the congregation return to the congregation with a clear recommendation.

See the [Responsibility Matrix](responsibility-matrix.md) for the detailed division of responsibilities.

Needs review against the KBC Constitution and Bylaws before final approval.
