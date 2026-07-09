import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicPaths = ['/login', '/api', '/favicon.ico']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
  const isRootPath = request.nextUrl.pathname === '/'

  // If user is not authenticated and trying to access a protected route, redirect to login
  if (!user && !isPublicPath && !isRootPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is authenticated and on the login page, redirect to submissions
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/submissions'
    return NextResponse.redirect(url)
  }

  // Admin-only routes protection
  if (request.nextUrl.pathname.startsWith('/dashboard/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    // Note: Role check happens at the page level since middleware can't easily query Prisma
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
