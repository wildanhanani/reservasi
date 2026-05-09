import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = request.cookies.get("reservasi_role")?.value;

  if (pathname.startsWith("/super-admin")) {
    if (role === "SUPER_ADMIN") return NextResponse.next();
    if (role === "RESTAURANT_ADMIN") return redirectToAdmin(request);
    return redirectToLogin(request, `${pathname}${search}`);
  }

  if (pathname.startsWith("/admin") && role !== "SUPER_ADMIN" && role !== "RESTAURANT_ADMIN") {
    return redirectToLogin(request, `${pathname}${search}`);
  }

  if (pathname.startsWith("/login") && role) {
    return role === "SUPER_ADMIN" ? redirectToSuperAdmin(request) : redirectToAdmin(request);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, next: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

function redirectToSuperAdmin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/super-admin";
  url.search = "";
  return NextResponse.redirect(url);
}

function redirectToAdmin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin";
  url.search = "";
  const slug = request.cookies.get("reservasi_restaurant_slug")?.value;
  if (slug) url.searchParams.set("slug", slug);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/super-admin/:path*", "/login"]
};
