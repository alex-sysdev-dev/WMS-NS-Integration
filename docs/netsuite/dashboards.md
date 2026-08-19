# NetSuite dashboards and portlets

Lower relevance — our UI is Next.js, not NetSuite. Kept because desk users (execs, purchasing) may prefer
some KPIs inside NetSuite where they already work, and because these limits decide whether that's viable.

## Structure

A **center** is the tabbed page set for a role; each page carries a **dashboard** of **portlets**.
Dashboards exist on every page except Documents, Setup, and Customization (`fid=chapter_N576403`).
Layouts: two-column narrow-left, two-column narrow-right, three-column wide-middle (needs a ≥1400px
screen), one-column (`fid=section_4072488196`).

Published dashboards come in three modes (`fid=section_N578457`): **Locked** (no content or layout change;
viewers can still set date range / accounting book), **Add/Move Content** (add and move, remove only your
own additions), **Unlocked** (full personalization). The Settings portlet can never be removed.

Column placement changes content: custom search and List portlets show 4 result columns in a narrow
column vs 9 in the center; report snapshot text truncates at 25 characters in a narrow column; the KPI
portlet drops trend-graph headlines in a narrow column (`fid=section_N581190`).

## Per-dashboard portlet limits

| Portlet | Max |
|---|---|
| Analytics (workbook chart / pivot / table) | 10 |
| Report Snapshots | 10 |
| Custom Search | 6 (home page) |
| Custom Portlet (SuiteScript) | 6 |
| Trend Graphs | 5 |
| KPI Meter | 3 |
| Calendar | multiple, independent |
| RSS/Atom Feed | 2 |
| Key Performance Indicators | 1 (up to 8 KPIs as headlines) |

Source: `fid=section_N577248` (Portlet Types Table). Custom dashboard pages share the standard Home page
limits. Charts are rendered by Highcharts JS.

A KPI Meter can only show a KPI already present in that dashboard's Key Performance Indicators portlet
(plus Actual vs. Forecast, Actual vs. Quota, Forecast vs. Quota), so the KPI portlet must be set up first
(`fid=section_4605495776`).

Most portlets are copied along with a published dashboard by the **Copy to Account** feature (Calendar,
Custom, Custom Search, KPI, KPI Meter, Quick Search, Search Form, Trend Graph, List).

## Dashboard Tiles SuiteApp

Managed SuiteApp, bundle **185219** (`fid=section_1501565708`). Gives bold KPI tiles with icons and
blinking alerts. Requires the Dashboard Tiles custom record permission (View minimum, Full maximum) on any
role that uses it.

Tile types (`fid=section_1548305654`):

- **Static** — a fixed value. Update it by SuiteScript when the metric needs more than one saved search.
- **Reminder** — the *count of results* in a saved search.
- **Scorecard** — the *sum of the first numeric column* of a saved search. Won't save if the search has no
  numeric column. ID and document-number columns don't count as numeric.
- **Comparison scorecard** — compares a saved search to a static value or to a second saved search.
  Comparison types: `Difference` (current ÷ previous), `Variance Percentage`
  (((current − previous) ÷ previous) × 100), `Absolute Ratio` (current − previous).
  Shows `N/A` on a calculation error, including divide-by-zero. Use custom saved searches, not standard.

Caps: **50 tiles** per portlet (extra tiles are dropped by display order), and only **30 comparison
scorecard tiles** display correctly. Saved searches for **wave transactions** are not supported. Saved
searches must be on SuiteScript-supported records; NetSuite does not validate them, so a broken search
silently renders wrong or `N/A`.

Conditional alerts (reminder and scorecard tiles only) blink the tile icon on
Greater/Less Than (Or Equal) Threshold. An icon must be set first, and **alerts are unsupported in the
Redwood theme** (`fid=section_1501566323`).

Tile `Name`, `Prefix`, `Display Value`, and `Suffix` are the only fields not covered by NetSuite's
multi-language support — translations must be entered per language on the tile's Translations subtab,
and a blank Prefix/Suffix on the Data subtab silently discards its translations
(`fid=section_1552457863`).

## Navigation Portlet SuiteApp

Managed SuiteApp, bundle **186103** (`fid=section_1501567502`). Shortcut groups organized under navigation
categories, added to the dashboard as a Custom Portlet with source `Navigation Portlet`.

Limits: **25 categories** with a full set of shortcut groups, **8 shortcut groups** displayed per portlet
(a group with a higher display-order value is created but not shown), **5 shortcuts** per group, up to
**4 category columns** (forced to 1 when the portlet sits in a side column). Shortcut URLs are **not
validated**. Requires View–Full permission on the Navigation Categories / Shortcut / Shortcut Group /
Shortcut Tooltip custom records.

## Sharing tiles and shortcut groups with more roles

Both SuiteApps use the same source-role → target-role copy pattern:
`Setup > Dashboard Tiles > Roles Update` and `Setup > Navigation Portlet > Roles Update`. Pick target
role(s) and a source role, Run Update, then watch the Schedule Script Status page for Complete. Inactive
source roles are skipped by the Navigation Portlet update (`fid=section_1501566413`, `_1501567976`).
