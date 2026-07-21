import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
  const url = `${BACKEND_URL}/api/${path}${req.nextUrl.search}`

  const headers: Record<string, string> = {}
  const cookie = req.headers.get('cookie')
  if (cookie) headers['cookie'] = cookie
  const contentType = req.headers.get('content-type')
  if (contentType) headers['content-type'] = contentType
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) headers['x-forwarded-for'] = forwarded

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const ct = req.headers.get('content-type') || ''
    body = ct.includes('multipart/form-data') ? await req.arrayBuffer() : await req.text()
  }

  const upstream = await fetch(url, { method: req.method, headers, body, redirect: 'manual' })

  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!['transfer-encoding', 'connection'].includes(key)) {
      responseHeaders.set(key, value)
    }
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
