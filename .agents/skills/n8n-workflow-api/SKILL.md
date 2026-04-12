---
name: n8n-workflow-api
description: >-
  Manage n8n workflows through the Public API: create (add), update, delete,
  activate/deactivate, and execution operations. Use when users ask to
  add/update/delete workflows, run or stop executions, retry failed runs, or
  automate n8n workflow lifecycle from API calls. Triggers on phrases like
  "create n8n workflow", "update workflow JSON", "delete workflow",
  "execute workflow", "retry execution", "activate workflow", or
  "n8n API workflow management".
argument-hint: Provide n8n instance base URL, auth method (API key), target operation (create/update/delete/execute), and workflow/execution ID if known.
---

# n8n Workflow API

Manage n8n workflows through the n8n Public API.

## When to use

Use this skill when the user needs to:

- Add/create a workflow (`POST /workflows`)
- Update a workflow definition (`PUT /workflows/{id}`)
- Delete a workflow (`DELETE /workflows/{id}`)
- Enable/disable workflow execution (`POST /workflows/{id}/activate`, `POST /workflows/{id}/deactivate`)
- Work with executions (list/get/stop/retry) via `/executions` endpoints

## Authentication and prerequisites

1. Confirm the API base URL: `https://{instance}.app.n8n.cloud/api/v1` (or self-hosted equivalent).
2. Require API key authentication with header:
   - `X-N8N-API-KEY: <token>`
3. Never expose raw API keys in chat output.
4. Validate user intent before destructive calls (delete, stop).

## Core workflow

1. **Clarify target**
   - Is this create/update/delete/activate/deactivate/execute?
   - Is the identifier a workflow ID or execution ID?

2. **Read current state first**
   - For updates/deletes, fetch the workflow (`GET /workflows/{id}`) first.
   - For execution actions, fetch execution details (`GET /executions/{id}`) first.

3. **Prepare payload safely**
   - For `PUT /workflows/{id}`, include required workflow fields:
     - `name`, `nodes`, `connections`, `settings`
   - Preserve unchanged fields unless user requests modifications.

4. **Execute API call**
   - Use the exact endpoint for the operation.
   - Handle known status paths (200/400/401/404 and similar).

5. **Verify and report**
   - Confirm resulting workflow/execution state.
   - Summarize what changed and any next action.

## Operation map

### Create (add)
- `POST /workflows`
- Required payload keys: `name`, `nodes`, `connections`, `settings`

### Update
- `PUT /workflows/{id}`
- Required payload keys: `name`, `nodes`, `connections`, `settings`
- Optional keys often seen: `pinData`, `shared`, `staticData`

### Delete
- `DELETE /workflows/{id}`
- Must ask for explicit confirmation unless user already confirmed.

### Activate / deactivate
- `POST /workflows/{id}/activate`
- `POST /workflows/{id}/deactivate`

### Execution operations
- `GET /executions`
- `GET /executions/{id}`
- `DELETE /executions/{id}`
- `POST /executions/{id}/retry`
- `POST /executions/{id}/stop`
- `POST /executions/stop`

## Important execute-workflow note

If a user says “execute workflow”, clarify **which execution path** they mean:

- Triggering via workflow trigger/webhook
- Retrying a prior execution (`POST /executions/{id}/retry`)
- Stopping an execution (`POST /executions/{id}/stop`)

Do not assume there is a single generic `POST /workflows/{id}/execute` endpoint unless confirmed by current API docs for the target version.

## Safety and quality checklist

- [ ] Correct base URL and auth header configured
- [ ] Operation target ID validated
- [ ] Pre-read performed for update/delete/execute-control operations
- [ ] Required fields present for create/update
- [ ] Destructive actions explicitly confirmed
- [ ] Response status checked and surfaced clearly
- [ ] Final state verified

## Usage examples

- “Create a new n8n workflow with this node graph and activate it.”
- “Update workflow `abc123` to add an HTTP node and keep everything else unchanged.”
- “Delete workflow `abc123` after confirming it exists.”
- “Retry execution `98765` and show me the resulting status.”
- “Stop all currently running executions.”

## References

- n8n API auth: `https://docs.n8n.io/api/authentication/`
- n8n API reference (Workflow): `https://docs.n8n.io/api/api-reference/#tag/workflow`
- n8n API reference (Execution): `https://docs.n8n.io/api/api-reference/#tag/execution`
