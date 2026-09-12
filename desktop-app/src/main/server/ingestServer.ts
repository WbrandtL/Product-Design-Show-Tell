import type Database from 'better-sqlite3'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { insertBrowserEvent } from '../db/rawEventsRepo'
import type { BrowserEventInput } from '../../shared/types'

/**
 * Fixed loopback port the browser extension POSTs to. Documented in
 * README.md and hardcoded into the extension's background script — this is
 * the entire "local channel" contract between the two modules.
 */
export const INGEST_SERVER_PORT = 47850

const MAX_BODY_BYTES = 1_000_000

function isValidBrowserEvent(value: unknown): value is BrowserEventInput {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.timestamp === 'number' &&
    typeof v.durationMs === 'number' &&
    v.durationMs >= 0 &&
    typeof v.domain === 'string' &&
    v.domain.length > 0 &&
    typeof v.isIdle === 'boolean'
  )
}

function setCorsHeaders(res: ServerResponse): void {
  // Loopback-only server consumed solely by our own extension's service
  // worker; wildcard origin is safe here since nothing sensitive is
  // returned and every accepted payload is schema-validated below.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * Starts the local HTTP ingest server the browser extension posts domain-
 * visit events to. Bound to 127.0.0.1 only (never 0.0.0.0), so it is not
 * reachable from the network. This is the sole narrow interface between the
 * browser extension module and the desktop app's data layer — see
 * ARCHITECTURE.md "Extension <-> desktop app channel".
 * Parameters:
 *     getDb (() => Database.Database): accessor for the shared SQLite connection
 * Returns:
 *     server (http.Server): the running server (call .close() to stop)
 */
export function startIngestServer(getDb: () => Database.Database): http.Server {
  const server = http.createServer((req, res) => {
    setCorsHeaders(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (req.method === 'POST' && req.url === '/events/browser') {
      void handleBrowserEvents(req, res, getDb())
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  server.listen(INGEST_SERVER_PORT, '127.0.0.1', () => {
    console.log(`[ingestServer] listening on http://127.0.0.1:${INGEST_SERVER_PORT}`)
  })

  server.on('error', (error) => {
    console.error('[ingestServer] failed to start:', error)
  })

  return server
}

async function handleBrowserEvents(req: IncomingMessage, res: ServerResponse, db: Database.Database): Promise<void> {
  try {
    const body = await readBody(req)
    const parsed = JSON.parse(body) as { events?: unknown }
    const events = Array.isArray(parsed.events) ? parsed.events : []
    const validEvents = events.filter(isValidBrowserEvent)

    for (const event of validEvents) {
      insertBrowserEvent(db, event)
    }

    console.log(`[ingestServer] stored ${validEvents.length}/${events.length} browser event(s)`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ stored: validEvents.length }))
  } catch (error) {
    console.error('[ingestServer] failed to process browser events:', error)
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid request' }))
  }
}
