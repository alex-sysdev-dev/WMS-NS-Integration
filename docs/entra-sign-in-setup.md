# Microsoft Entra sign-in

How staff sign in to the WMS, what an admin has to create, and what to paste
where once they have.

Auth.js is wired and the code is complete. Nothing works until the app
registration exists, and the login page says so rather than offering a button
that fails.

---

## What this covers, and what it does not

Entra covers **staff**: Alex, Matt, Brandon, Justin, and anyone else at LED with
a Microsoft account.

It does **not** cover fabrication associates at the station. Omar is a temp with
no Microsoft account, and the fab laptops are shared, so a session-based login
would attribute a whole week of timer activity to whoever signed in first. The
station is a separate surface authorized by badge scan per action. Getting the
app registration does not unblock it.

---

## Step 1: an M365 admin creates the app registration

This is an Azure portal action and cannot be self-served.

Azure portal, Microsoft Entra ID, App registrations, New registration.

| Field | Value |
| --- | --- |
| Name | LED Connection WMS |
| Supported account types | **Single tenant** (this directory only) |
| Redirect URI | Web, `http://localhost:3000/api/auth/callback/microsoft-entra-id` |

Then add the production redirect URI as a second entry once the host is known:
`https://<production-host>/api/auth/callback/microsoft-entra-id`

Under Certificates & secrets, New client secret. **Copy the Value immediately**,
it is only shown once, and note the expiry date. Sign-in breaks for everyone
when a secret lapses, so it needs a calendar reminder.

API permissions need only `openid`, `profile`, `email`. These are default
delegated permissions and require no admin consent. Worth stating explicitly
when requesting the registration, because "app registration" is sometimes heard
as a broad Microsoft Graph request and stalls on a security review it does not
need.

---

## Step 2: who is allowed in

By default every account in the LED tenant can sign in. That is probably not
what you want for a system that will hold inventory and labor data.

To restrict it: on the Enterprise application for this registration, set
**Assignment required** to Yes, then assign a security group. Anyone outside the
group is refused by Entra before reaching the app, and lands back on the login
page with a message.

---

## Step 3: paste into `.env.local`

Create `.env.local` in the repo root if it does not exist. It is gitignored and
must never be committed.

```
AUTH_MICROSOFT_ENTRA_ID_ID=<Application (client) ID from the overview page>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<the secret VALUE, not the secret ID>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
AUTH_SECRET=<generate, see below>
```

`AUTH_SECRET` does not come from Azure. Generate one:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

In production only, also set `AUTH_URL=https://<production-host>`. Auth.js
cannot infer the host from a request behind a proxy. Leave it unset for
localhost.

All four are read by `isEntraConfigured()` in `lib/auth/config.ts`. The moment
the first three are present, the login page swaps the "not configured" notice
for a working **Continue with Microsoft** button.

---

## Step 4: map people to the roster

`lib/fab-team.ts` carries an `entraUpn` field per member, currently `null` with
a TODO. Fill in the LED Microsoft address for Matt, Brandon, and Justin.

Omar's stays `null` permanently. That is by design, not an omission, and the
comment on his entry says so.

You do not need Entra object IDs. Matching runs on email first, and the
immutable object ID gets captured into `authSubject` on each person's first
sign-in, which is more reliable than transcribing GUIDs.

Staff who are not on the fab roster still sign in fine. They get `fabMemberId:
null` and the full app rather than a fab surface, which is the correct
behaviour for Alex and anyone else outside fabrication.

---

## Until then

Set `LOCAL_DEV_PLATFORM_ACCESS=true` in `.env.local` to browse the app without
signing in. It is hard-gated on `NODE_ENV` in `lib/dev-access.ts` and cannot be
active in a production build.

That bypass user is stamped `isLocalDev: true` and named "Local Dev
(unauthenticated)", so anything that records attributable activity can tell it
apart from a real person on the floor.

---

## Where the code lives

| File | Role |
| --- | --- |
| `lib/auth/config.ts` | Provider, callbacks, roster resolution. The only file that knows Entra exists. |
| `lib/auth/current-user.ts` | The seam. Everything else asks this who is signed in. |
| `app/api/auth/[...nextauth]/route.ts` | Callback and session endpoints. |
| `components/auth/LoginForm.tsx` | Sign-in card, including the not-configured notice. |
| `proxy.ts` | Edge route protection. First gate, not the only one. |
| `types/next-auth.d.ts` | Session claim types. |

Adding a second identity path for the station means adding it behind
`lib/auth/current-user.ts`, not alongside it. Nothing outside `lib/auth/` should
ever import a provider directly.
