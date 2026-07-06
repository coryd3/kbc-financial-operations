# KBC Organization Chart

Status: Draft

## Purpose

This document provides a working organization chart for Kingsville Baptist Church based on the current financial operations modernization documents.

It is intended to help leaders see the difference between:

- Congregational authority.
- Elected officers and committees.
- Ministry leadership.
- Financial operations support.
- Committee recommendations and coordination.

Needs Bylaw Review: This chart should be checked against the KBC Constitution and Bylaws, committee charters, and current church practice before being treated as authoritative.

## Simple Governance View

```mermaid
flowchart TD
    Congregation["Congregation<br/>Final authority where bylaws, budget, policy, or church practice require a vote"]

    Pastor["Pastor<br/>Spiritual leadership, ministry leadership, communication, counsel"]
    Deacons["Deacons<br/>Servant leadership, care, counsel, leadership review where church practice requires"]
    Officers["Elected Officers<br/>Including Treasurer / Financial Officer and other officers defined by bylaws"]
    Committees["Church Committees<br/>Finance, Personnel, Nominating, and other committees"]

    Congregation --> Pastor
    Congregation --> Deacons
    Congregation --> Officers
    Congregation --> Committees

    Nominating["Nominating Committee<br/>Officer and committee nomination process where assigned by bylaws"]
    Finance["Finance Committee<br/>Financial policy, controls, budget oversight, software, monthly review"]
    Personnel["Personnel Committee<br/>Job descriptions, hiring process, compensation recommendations, evaluations"]

    Committees --> Nominating
    Committees --> Finance
    Committees --> Personnel

    Treasurer["Treasurer / Financial Officer<br/>Elected accountability, reporting, review, Finance Committee coordination"]
    Bookkeeper["Bookkeeper / Financial Administrator<br/>Authorized paid role for day-to-day financial records and support"]
    Vendor["Outside Payroll / Accounting Vendor<br/>Specialized payroll, tax, accounting, or review support if contracted"]

    Officers --> Treasurer
    Personnel --> Bookkeeper
    Finance -. financial duties, controls, reports .-> Bookkeeper
    Treasurer -. review and coordination .-> Bookkeeper
    Finance -. scope and review .-> Vendor
    Treasurer -. liaison if assigned .-> Vendor
```

## Financial Operations View

```mermaid
flowchart LR
    Congregation["Congregation<br/>Approves Treasurer election, budget, and other items required by bylaws or church practice"]
    Nominating["Nominating Committee<br/>Recommends elected officers if assigned by bylaws"]
    Treasurer["Treasurer / Financial Officer<br/>Elected accountability and reporting"]
    Finance["Finance Committee<br/>Financial policies, controls, software, budget oversight, monthly review"]
    Personnel["Personnel Committee<br/>Authorized hiring process for paid Bookkeeper role"]
    Bookkeeper["Bookkeeper / Financial Administrator<br/>Day-to-day records, reports, deposits, reimbursements, documentation"]
    PastorDeacons["Pastor and Deacons<br/>Leadership counsel, communication support, review where appropriate"]
    Vendor["Outside Payroll / Accounting Vendor<br/>Payroll, tax, accounting support if contracted"]

    Congregation --> Nominating
    Nominating --> Treasurer
    Congregation --> Finance
    Congregation --> Personnel
    Congregation --> PastorDeacons

    Finance <--> Treasurer
    Finance -. defines financial duties and controls .-> Bookkeeper
    Personnel --> Bookkeeper
    Bookkeeper -. prepares records and reports .-> Treasurer
    Bookkeeper -. prepares monthly packet .-> Finance
    Finance -. recommends vendor scope .-> Vendor
    Treasurer -. coordinates if assigned .-> Vendor
    PastorDeacons -. counsel and communication .-> Finance
    PastorDeacons -. counsel and communication .-> Personnel
```

## Practical Role Summary

| Body / Role | Primary Accountability | Main Responsibilities In This Project |
| --- | --- | --- |
| Congregation | Final church authority where bylaws, budget, policy, officer election, or church practice require a vote. | Has already authorized Personnel Committee to hire a paid Bookkeeper / Financial Administrator; votes later on items that require church approval. |
| Pastor | Spiritual and ministry leadership, communication, and counsel. | Helps keep the process calm, ministry-focused, and aligned with church leadership. |
| Deacons | Servant leadership, care, counsel, and leadership review where church practice requires. | May review major recommendations, help preserve unity, and support communication with the church. |
| Nominating Committee | Officer and committee nomination process where assigned by bylaws. | Involved in Treasurer / Financial Officer recommendations if bylaws assign that role. |
| Finance Committee | Financial governance, controls, budget oversight, software, monthly review, and financial policies. | Defines financial duties, software requirements, reimbursement rules, spending authority, card/payment controls, audit/review process, and budget impact. |
| Personnel Committee | Job descriptions, hiring, compensation recommendations, and evaluation process. | Leads the authorized hiring process for the paid Bookkeeper / Financial Administrator after Finance Committee confirms financial duties and controls. |
| Treasurer / Financial Officer | Elected financial accountability, reporting, review, and coordination with Finance Committee. | Reviews reports, helps present financial information, confirms policies are followed, and coordinates with the Bookkeeper and Finance Committee. |
| Bookkeeper / Financial Administrator | Day-to-day financial operations under assigned supervision and approved financial controls. | Maintains records, enters transactions, supports deposits, processes reimbursements after approval, prepares report packets, and supports monthly close. |
| Outside Payroll / Accounting Vendor | Professional processing and compliance support if contracted. | Handles payroll, tax forms, accounting setup, review, or other specialized services assigned by church-approved process. |

## Recommended Reporting And Coordination Lines

These lines should be confirmed before hiring or final implementation:

- The Bookkeeper / Financial Administrator should have one clear day-to-day supervisor.
- The Finance Committee should define the Bookkeeper's financial duties, access, reports, and controls.
- The Treasurer should review and coordinate with the Bookkeeper but should not become the sole source of operational knowledge.
- Personnel Committee should manage hiring, personnel records, evaluation process, and compensation recommendations.
- Finance Committee should not run the hiring process.
- Personnel Committee should not decide financial controls, software, reimbursement rules, card policy, or spending authority.

## Open Questions

- Who is the day-to-day supervisor for the Bookkeeper / Financial Administrator?
- What exact motion did the congregation approve for the paid Bookkeeper role?
- Do bylaws assign Treasurer nomination to the Nominating Committee, Deacons, or another process?
- Which financial decisions require Finance Committee recommendation only, and which require church vote?
- Which recommendations should go to Deacons or broader leadership before coming to the congregation?
- What reports should go monthly to Finance Committee, Deacons, church leadership, and the congregation?

Final approval path to be confirmed by church leadership, bylaws, church practice, and the recorded scope of the prior congregational vote.
