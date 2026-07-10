---
name: Verifying GIN trigram indexes with EXPLAIN
description: Why EXPLAIN shows seq scan for trgm indexes when test rows are inserted in an uncommitted transaction
---
When verifying a pg_trgm GIN index with EXPLAIN, rows bulk-inserted inside the same (uncommitted) transaction sit in the GIN pending list, which massively inflates the index cost estimate — the planner picks a seq scan even for highly selective terms.

**Why:** GIN fastupdate buffers new tuples in a pending list; cost estimation charges for scanning it. A `BEGIN; INSERT ...; ANALYZE; EXPLAIN; ROLLBACK` check will falsely suggest the index is unused.

**How to apply:** Verify in the disposable `*_test` database: commit the fake rows, run `VACUUM ANALYZE` (merges the pending list), then EXPLAIN — the BitmapOr over the trgm indexes appears naturally. `SET enable_seqscan = off` also confirms the index is usable. Trigram expression indexes must match the query expressions exactly (e.g. `first_name || ' ' || last_name`).
