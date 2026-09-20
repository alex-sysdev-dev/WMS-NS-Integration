# CLAUDE.md — WMS_Build

Always-on rules for every Claude session and every subagent in this repo.
Subagents do not inherit chat history, so anything that must never be violated
lives here, not in a conversation.

Full background: run the `wms-context` skill. Cross-project facts: `led-connection` skill.
Guardrail design and how to change it: `docs/agent-guardrails.md`.

---

## 1. Hard rules (mechanically enforced, do not attempt to work around)

1. **No NetSuite writes. None.** Not production, not sandbox. `ns_createRecord`,
   `ns_updateRecord`, and every write RESTlet are off the table until Alex
   explicitly lifts this. Reading production for discovery is fine and
   encouraged. If a task appears to need a write, stop and hand it to Alex.
   Do not propose a workaround, do not ask for an exception mid-task.
2. **No DML through SuiteQL.** `ns_runCustomSuiteQL` is for `SELECT` only. No
   `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `TRUNCATE`, `DROP`, `ALTER`.
3. **NetSuite is the only datastore. Do not add a second one.** Supabase has
   been removed entirely: no client, no tables, no migrations, no `@supabase/*`
   packages, no `supabase/` directory. Do not reintroduce it, and do not reach
   for Postgres, SQLite, Prisma, or a hosted database to fill the gap while the
   NetSuite integration is unbuilt. Unconnected modules return honest empties
   behind a `*_SOURCE_READY` flag. If state has nowhere to live in NetSuite,
   the answer is a NetSuite custom record or an explicit, argued exception
   raised to Alex.
4. **Never read, print, or edit secrets.** `.env`, `.env.local`, `*.pem`,
   client secrets, API keys. `ANTHROPIC_API_KEY`, `AUTH_SECRET`, and
   `AUTH_MICROSOFT_ENTRA_ID_SECRET` are server-only and must never be prefixed
   `NEXT_PUBLIC_`.
5. **Never fabricate data.** No sample rows, no seeded demo values, no invented
   KPI numbers. An empty page and a working page must never look the same.
   Unconnected modules render honest empty states with a visible notice.
6. **Never say "outtake" in UI copy, docs, commits, or labels.** Say "shipping."
   The only permitted appearances are literal NetSuite metadata identifiers
   (`custentity_ledreadyforouttake`, the "Pending Outtakes" saved search).
7. **No destructive git or shell.** No `git push --force`, no history rewrite,
   no recursive delete outside a scratch directory.
8. **Identity lives behind one seam.** `lib/auth/current-user.ts` is the only
   place the app asks who is signed in. Nothing outside `lib/auth/` imports an
   auth provider. Staff authenticate through Microsoft Entra; fabrication
   associates cannot, and their path is a badge scan per action rather than a
   session, because temps have no Microsoft account and the fab laptops are
   shared.

## 2. Facts a subagent must not re-derive or guess

- The **job (project)** is the unit of work, not the sales order. Key queues,
  labels, and views on the project.
- Inventory is **lot-tracked, never serialized**. Every transaction needs
  **item + lot + bin + qty**.
- **Lots are keyed to the PO, not the item.** Rule is PO number + MM/YY
  (`PO2903 8/26`). Every line on one PO shares one lot. Software generates it.
- **Zero Item Receipts exist account-wide.** Inbound is recorded against the
  **Vendor Bill**, which does carry the Inventory Detail subrecord.
- The MCP connector's `transaction` table exposes only seven types. Every other
  type errors "Record not found," which is **not** the same as zero rows. Never
  claim a record type is empty from a connector query. Say "not visible via the
  connector" and have Alex confirm in the NetSuite UI.
- **SuiteQL is Oracle-flavored.** No CTEs, use `TO_DATE(...)`. The MCP transport
  HTML-escapes `>` and `<` and breaks the parser. Use `BETWEEN` or `!=`.
- Any specific number in the docs was true in early August 2026. **Re-query
  rather than trusting a remembered figure.**

## 3. Reporting rules

- Distinguish **verified** (queried this session, cite the query) from
  **remembered** (from a doc, may be stale) from **assumed**. Never blur them.
- If a tool returns an error or an empty result, say so plainly. Do not
  substitute a plausible answer.
- Give the answer upfront. No "one thing to note" trailers.
- No em dashes in any output. Use commas, periods, or parentheses.

## 4. Verification before claiming done

Windows npm script wrappers are unreliable under automation. Use direct entrypoints:

```
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/eslint/bin/eslint.js app components lib types
node ./node_modules/next/dist/bin/next build
```

Node lives at `C:\Users\AlexAguilar\node\node-v22.20.0-win-x64` and is not on PATH.
Prepend it before running the above.

Never report a change as complete without a clean typecheck. Never report a
NetSuite finding as fact without the query that produced it.

## 5. Delegation rules

When spawning a subagent, use the narrowest definition in `.claude/agents/`:

| Agent | Use for | Cannot |
| --- | --- | --- |
| `netsuite-analyst` | Read-only NetSuite discovery and SuiteQL | Write files, write NetSuite |
| `wms-implementer` | Code changes in this repo | Touch NetSuite at all |
| `doc-writer` | Docs, SOPs, context files | Run code, touch NetSuite |

A subagent gets the constraints it needs restated in its prompt. Do not assume
it read this file.
