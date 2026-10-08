# NEXA frontend

The React/Vite app contains the NEXA landing page, authentication screens, customer ticket workspace, AI triage center, and staff reply approval workspace.

## Run

In a PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

The app uses `http://localhost:5000/api` by default. To change the API address, copy the frontend [.env.example](./.env.example) to `.env` and update `VITE_API_URL`. Frontend variables are embedded in the browser build; never put secrets or private API keys in a `VITE_*` variable.

The backend uses its own `backend/.env` file; configure it using [backend/.env.example](../backend/.env.example). Keep both `.env` files local and do not commit them. `.gitignore` excludes `.env` and environment-specific variants while allowing the safe example files to be tracked.

## Verify

```powershell
cd frontend
npm run lint
npm run build
```

## Authentication

- Registering creates a customer account and signs it in.
- Login destinations are based on the role returned by the backend, not a role supplied by the browser.
- Session JWTs are held in an HttpOnly cookie; the frontend does not store tokens in local storage.
- A user must be authenticated to open the matching role dashboard route.
- Customer ticket creation, edits, messages, attachments, closing, and deletion are backed by the customer-scoped ticket API.
- Ticket attachments support PDF, JPG, PNG, and WebP files (up to three files, 2 MB each).
- Agents, supervisors, and administrators can open their role-protected AI Triage Center and AI Draft Reply workspace.
- Agents can use the role-protected Support Agent Dashboard to claim tickets, open the selected ticket in Live Chat or AI Draft Reply, escalate to the shared supervisor queue, resolve assigned tickets, and monitor priority-specific first-response SLA countdowns. Initial SLA targets are Critical 15m, High 1h, Medium 4h, and Low 24h.
- Supervisors and admins can open the responsive Analytics workspace for MongoDB-backed resolution, ticket volume, first-response, escalation, category, and CSAT metrics over 7/30/90-day ticket cohorts. CSAT remains unavailable until customers submit ratings for resolved tickets; analytics does not invent values.
- Administrators have a role-protected workspace for live overview metrics, user/agent role and account management, ticket assignment/status/priority updates, read-only role permissions and AI provider status, workspace identity settings, and an attributed audit history. AI secrets are deployment-managed and never shown in the browser.
- Authenticated users have a persistent Notifications inbox with unread counts, mark-read controls, ticket deep links, and live Socket.IO updates for assignments, messages, AI drafts, escalations, resolutions, and SLA warnings. The global notification badge stays available across workspace routes.
- Customers can submit a one-time 1–5 star rating and optional feedback for each resolved ticket from the dedicated Feedback page. Submitted surveys are persisted separately from tickets and show a thank-you confirmation.
- The public Contact page provides location, email, phone-support availability, a Live Chat sign-in link, and a validated inquiry form; submissions are stored by the backend and the UI displays a confirmation or actionable errors.
- All signed-in roles can search the MongoDB-backed Knowledge Base and open cited source articles. The current search is keyword retrieval, not generative RAG; the UI explicitly reports that no LLM answer was generated. Admins can publish verified articles from the page.
- AI reply drafting requires a backend provider configuration; without one, staff can compose and save a manual reply instead. The UI does not fabricate AI output.
- Live Chat connects to authenticated Socket.IO ticket rooms. Messages, attachments, voice notes, typing state, online presence, read receipts, and notifications are wired to the backend; messages persist in MongoDB.
- Voice Assistant uses one-shot browser Web Speech recognition after an explicit button press. It supports “Open dashboard”, “Go to my tickets”, “Create a new ticket”, “Show high priority tickets”, “Open ticket 1048”, “Go to live chat”, “Open AI triage”, “Open analytics” (supervisors/admins), “Open Knowledge Base”, public Home sections, login/registration, and sign-out. Notifications and Profile destinations are reported as unavailable until those pages are implemented; unsupported browsers receive a clear message and retain all normal controls.
