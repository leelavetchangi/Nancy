# NEXA backend

The Express API implements MongoDB-backed authentication, ticket workflows, live chat, and optional AI provider integrations.

## Prerequisites

- Node.js 20.19+ (or 22.12+)
- MongoDB running locally, or a MongoDB connection URI

## Configure and run

From a PowerShell terminal:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` with your MongoDB URI and a unique JWT secret of at least 32 characters. The backend [.env.example](./.env.example) lists the supported settings; AI provider URLs and keys are optional. Generate a secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Do not commit `.env`.

Start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000` by default. Health check: `GET http://localhost:5000/api/health`.

## API organization

Express routes are split by feature and mounted under the documented `/api` groups. Controllers handle HTTP requests, services contain shared business logic, models define MongoDB persistence, and middleware provides authentication, authorization, validation, uploads, and error handling.

- `/api/auth` — registration, login, current session, and logout
- `/api/users` — authenticated user profile (`GET /api/users/me`)
- `/api/tickets` and `/api/messages` — customer tickets and participant-authorized ticket conversations (`GET` or `POST /api/messages/tickets/:ticketId`)
- `/api/ai` — triage under `/triage` and assisted replies under `/replies`
- `/api/chat` — live-chat conversations and attachment endpoints; Socket.IO events share the same persisted messages
- `/api/agents/tickets` — staff queues and agent ticket actions
- `/api/supervisor/analytics` — supervisor/admin analytics
- `/api/admin`, `/api/knowledge`, `/api/csat`, `/api/notifications`, and `/api/contact` — administration, articles, surveys, notifications, and contact submissions

The previous `/api/agent/tickets` and `/api/analytics` paths remain mounted as compatibility aliases. The server entry point only connects infrastructure and starts the HTTP/Socket.IO server; feature routes, controllers, models, services, and middleware remain separated.

## Error handling

The frontend shows route-level loading indicators, form/action feedback, retryable request errors, and empty states; an application error boundary provides a safe recovery screen for unexpected render failures. Axios requests include credentials and a bounded timeout, and expired sessions are redirected to sign-in.

The API validates malformed JSON, uploads, Mongoose validation, and object identifiers with client-safe responses. Unknown routes return JSON 404 responses; duplicate records return 409; unavailable MongoDB/network errors return a retryable 503; unexpected failures return a generic 500. Responses do not include passwords, secrets, stack traces, or database/provider internals. Authentication failures return 401, and role/ownership failures return 403 or scoped 404 responses.

## Auth endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/users/me` — alias for the authenticated profile response

Passwords are hashed with bcrypt. Sessions use an HttpOnly cookie. Public registration always creates a customer account; privileged roles must be assigned through a trusted admin process. The login response and protected middleware read the role from MongoDB.

## Contact form

- `POST /api/contact` — submit `{ "name": "...", "email": "...", "message": "..." }`

Contact inquiries are validated and saved in the `contactmessages` MongoDB collection with normalized email, a `new` status, and timestamps. The public endpoint is rate-limited to five requests per IP per 15 minutes; the form includes a honeypot field to screen basic automated submissions.

## Customer ticket endpoints

- `GET /api/tickets` — list the authenticated customer's tickets
- `POST /api/tickets` — create a ticket (`subject`, `description`, `category`, `priority`, optional `attachments`)
- `GET /api/tickets/:ticketId` — get a ticket and its conversation/attachment metadata
- `PUT /api/tickets/:ticketId` — update subject, description, category, or priority while the ticket is pending and unassigned
- `DELETE /api/tickets/:ticketId` — delete a pending, unassigned ticket with no replies; attachments are removed with it
- `POST /api/tickets/:ticketId/messages` — add a conversation message; a resolved ticket reopens as pending, a closed ticket cannot receive replies
- `POST /api/tickets/:ticketId/attachments` — add attachments to an open ticket
- `GET /api/tickets/:ticketId/attachments/:attachmentId` — download an attachment
- `POST /api/tickets/:ticketId/close` — close the ticket

Every endpoint requires a customer session, scopes lookup to the authenticated customer, and returns 404 for tickets owned by another account. Ticket ownership is never accepted from the request body. Attachments are limited to three PDF/JPG/PNG/WebP files per ticket, at 2 MB each. File content signatures are checked and files are stored as binary documents in MongoDB; downloads require ticket ownership and are sent as attachments.

## Messages

- `GET /api/messages/tickets/:ticketId` — return the latest 200 messages in chronological order
- `POST /api/messages/tickets/:ticketId` — persist and broadcast a text message from an authorized ticket participant

Both endpoints require authentication and apply the same customer ownership or staff-role checks as live chat. Closed tickets cannot receive messages. Messages are saved in the `messages` collection and linked to their ticket; the existing customer-only ticket message endpoint remains available for compatibility.

## CSAT surveys

- `GET /api/csat` — list resolved/closed tickets eligible for rating plus submitted surveys
- `POST /api/csat` — submit `{ "ticketId": "...", "rating": 1, "feedback": "Optional feedback" }`

Submissions use the `CSAT` model and are stored in the `csat_surveys` collection with `ticketId` and `userId` references plus `rating`, `feedback`, and timestamps. The API verifies ticket ownership and resolved/closed state, and a unique ticket index prevents duplicate ratings. Rated tickets remain visible in the survey history if they later reopen. Analytics joins these persisted surveys to the ticket cohort; legacy ticket-embedded ratings remain readable for compatibility.

## Support agent dashboard and SLAs

These queue endpoints require an authenticated agent, supervisor, or admin:

- `GET /api/agents/tickets` — list active priority queues; agents see unassigned tickets and their own, while supervisors/admins see all active tickets
- `POST /api/agents/tickets/:ticketId/accept` — atomically claim an unassigned pending or escalated ticket
- `POST /api/agents/tickets/:ticketId/escalate` — hand an active ticket to an available supervisor (or admin if no supervisor is active); agents may escalate unassigned tickets or tickets assigned to themselves
- `POST /api/agents/tickets/:ticketId/resolve` — resolve a ticket assigned to the current agent (supervisors/admins may resolve any active ticket)

First-response SLA targets are Critical 15 minutes, High 1 hour, Medium 4 hours, and Low 24 hours from ticket creation. The response deadline is stored on each ticket, remains unchanged when the ticket is accepted or escalated, and is recalculated if the customer changes priority before support starts. The dashboard counts down against server time and marks tickets at risk at 15 minutes remaining, urgent at 5 minutes, and overdue after the deadline. These are initial product defaults and should be aligned with the support team's contractual targets before production.

## Supervisor analytics

- `GET /api/supervisor/analytics?days=7|30|90` — MongoDB-backed ticket, resolution, first-response, escalation, category, and CSAT metrics for the selected ticket-creation cohort; requires a supervisor or admin session

AI-assisted resolutions are tickets resolved through the human-approved AI draft flow. Human resolutions are resolved/closed tickets without an AI draft approval. First-response time uses the earliest persisted support-staff message after ticket creation. CSAT is averaged only across persisted survey responses; no ratings are fabricated when there are no responses. Missing response/CSAT data is returned as unavailable, not zero.

The compatibility alias `GET /api/analytics` serves the same endpoint.

## Administrator workspace

Every `/api/admin` endpoint requires an authenticated administrator role read from MongoDB:

- `GET /api/admin/overview` — current user/ticket/article totals, AI provider connection state, and recent admin activity
- `GET /api/admin/users` and `PATCH /api/admin/users/:userId` — search users and update role or active status
- `GET /api/admin/tickets` and `PATCH /api/admin/tickets/:ticketId` — search tickets and update status, priority, or active support-staff assignment
- `GET /api/admin/permissions` — read-only server role-permission reference
- `GET /api/admin/audit-logs` — latest 100 attributed administrative changes
- `GET /api/admin/settings` and `PATCH /api/admin/settings` — read or update workspace name and support contact email

The API prevents an administrator from revoking their own access or deactivating/demoting the final active administrator. Ticket assignments must target an active support account. User, ticket, and workspace setting changes are written through the `AuditLog` model to the existing `adminauditlogs` collection. AI-provider secrets and endpoints remain deployment-managed and are never returned by the admin API.

## Notifications

- `GET /api/notifications` — list the authenticated user's latest 100 notifications and unread count
- `PATCH /api/notifications/:notificationId/read` — mark one owned notification as read
- `PATCH /api/notifications/read-all` — mark all of the user's unread notifications as read

Notifications are persisted per active recipient and delivered over the authenticated Socket.IO `notification:new` event to that user's private room. Ticket creation, assignment, escalation, replies, AI draft generation, and resolution generate notifications for their appropriate customer or support recipients. The server's SLA scheduler sends one warning when an active ticket enters its final 15 minutes; an atomic ticket timestamp prevents duplicate warnings across server instances.

## Knowledge Base and retrieval

- `GET /api/knowledge/popular` — list published MongoDB articles ranked by recorded views
- `GET /api/knowledge/search?q=...` — search published articles using MongoDB text-index retrieval and return ranked snippets/sources
- `GET /api/knowledge/articles/:articleId` — load a published source and increment its view count
- `POST /api/knowledge/articles` — create an article (admin only)
- `PUT /api/knowledge/articles/:articleId` and `DELETE /api/knowledge/articles/:articleId` — update or remove articles (admin only)

The knowledge service separates article retrieval from answer generation. The initial retriever uses MongoDB text search; it does not use embeddings and does not generate an AI answer. Search responses identify the retrieval provider, return source articles/snippets, and report the answer provider as unconfigured. An answerer can later be injected through the service contract with `answer({ query, sources })`. There are no bundled fake or seed articles; admins can publish verified content through the article endpoint or the admin Knowledge Base page.

## MongoDB model relationships

- `User` owns customer tickets and is referenced by ticket assignments, message authors, notifications, knowledge article authors, CSAT submissions, and audit entries.
- `Ticket` belongs to a customer, may be assigned to a support user, and stores references to its `Message` documents and `TicketAttachment` documents.
- `Message` belongs to one ticket and one author, can reference ticket attachments, and records read and creation/update timestamps. Messages are stored in the `messages` collection rather than embedded in tickets.
- `Notification` references its recipient and optional ticket. `KnowledgeArticle` references its creator and last editor.
- `CSAT` references its ticket and submitting user. `AuditLog` references the acting user. `ContactMessage` is an unauthenticated public inquiry and therefore has no user reference.
- All requested models use Mongoose timestamps. Existing CSAT and audit collection names are retained to preserve persisted data.

### Existing ticket-message migration

Before deploying the normalized `Message` relationship to a database containing tickets, back up MongoDB, configure `MONGO_URI`, stop the API, then run `npm run migrate:messages` from `backend`. The migration preserves embedded message IDs, authors, attachments, read state, and timestamps, and is safe to rerun after an interrupted migration. Start the API only after the migration completes. New databases can start without running it.

## AI triage

- `GET /api/ai/triage/tickets` — list pending tickets for an authenticated agent, supervisor, or admin
- `POST /api/ai/triage/tickets/:ticketId/analyze` — analyze and persist a triage assessment

Without `AI_TRIAGE_URL`, NEXA uses a deterministic **keyword-rule preview**, clearly labelled as non-AI; it always requires human review and never makes an assignment. To use an AI service, set `AI_TRIAGE_URL` (and optionally `AI_API_KEY`). The configured HTTPS service receives a `POST` JSON body shaped as `{ "ticket": { "subject", "description", "category", "priority" } }` and must return JSON with `category` (`technical|billing|account|product|other`), `priority` (`low|medium|high|critical`), `sentiment` (`positive|neutral|frustrated|negative`), `confidence` (0–1), `recommendedTeam` (2–80 characters), and `rationale` (2–500 characters). Invalid, oversized, or timed-out provider responses fail explicitly; they do not fall back to simulated AI.

Configuring a remote provider sends ticket subject and description to that service. Only configure a provider approved to process your support data. Provider confidence below 0.80 is automatically escalated for human review. Higher-confidence output is only a team recommendation; it does not assign the ticket.

## AI draft reply and approval

These staff endpoints require an authenticated agent, supervisor, or admin:

- `GET /api/ai/replies/tickets` — list open tickets and recent conversation context
- `POST /api/ai/replies/tickets/:ticketId/generate` — request and save an AI reply suggestion
- `PUT /api/ai/replies/tickets/:ticketId/draft` — save a human-authored or edited draft (`{ "text": "..." }`)
- `POST /api/ai/replies/tickets/:ticketId/approve` — atomically post the saved draft as a support message and resolve the ticket
- `POST /api/ai/replies/tickets/:ticketId/escalate` — assign the ticket to the authenticated staff member and mark it escalated

AI generation is optional. Configure `AI_DRAFT_URL` and optionally `AI_DRAFT_API_KEY` to use a provider. The backend sends a `POST` JSON body with `ticket.subject`, `ticket.description`, `ticket.category`, `ticket.priority`, and up to 20 recent messages (`role` and `body`). The provider must return JSON shaped as `{ "reply": "A customer-ready response", "confidence": 0.93, "suggestedActions": ["Verify the account email"] }`. `reply` must be 10–2,000 characters, `confidence` must be from 0 to 1, and `suggestedActions` may contain up to five strings of 2–120 characters. Provider timeouts, errors, oversized responses, and invalid output fail explicitly; no simulated AI reply is substituted.

When no AI provider is configured, the UI clearly disables generation but still allows staff to write and save a manual draft, then approve it or escalate the ticket. Editing and approval do not call an AI provider. Configuring a remote provider sends customer-written ticket text and recent conversation messages to that service; use only a provider approved to process support data. AI drafts are never sent automatically: approval records the response in the ticket conversation and resolves it. Escalation records the authenticated staff member as the assignee.

## Live chat

Ticket conversations use Socket.IO for real-time message delivery, typing indicators, online presence, read receipts, and in-app message notifications. Socket handshakes authenticate the same HttpOnly `nexa_session` cookie as the REST API. Customers can only join their own ticket rooms; agents, supervisors, and admins can join support conversations. Text messages are validated and saved as MongoDB `Message` documents, linked from their ticket, before they are broadcast. A lost or rejected save is returned to the sender rather than presented as a delivered message.

- `GET /api/chat/tickets` — list conversations available to the authenticated customer or support staff
- `GET /api/chat/tickets/:ticketId` — load ticket context and persisted messages
- `POST /api/chat/tickets/:ticketId/attachments` — upload an attachment/voice message (multipart field `attachment`, maximum 2 MB, three attachments per ticket)
- `GET /api/chat/tickets/:ticketId/attachments/:attachmentId` — download or play an authorized attachment

Socket events: `chat:join`, `chat:leave`, `chat:send`, `chat:typing-start`, `chat:typing-stop`, and `chat:mark-read`; the server emits `chat:message`, `chat:typing`, `chat:read`, `chat:notification`, and conversation-scoped participant events. Attachments are stored in MongoDB, validated by content signature, and only downloadable by a participant in that ticket. Voice messages are recorded in the browser and uploaded as WebM/MP4 audio attachments where supported.

## Tests

```powershell
cd backend
npm test
```
