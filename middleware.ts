import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Temporarily disable middleware for debugging
export async function middleware(request: NextRequest) {
  console.log('🔍 Middleware (disabled):', request.nextUrl.pathname)
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Temporarily match nothing to disable middleware
    '/middleware-disabled'
  ],
}