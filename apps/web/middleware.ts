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
  const url = appUrl(request, "/login");
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

function redirectToSuperAdmin(request: NextRequest) {
  return NextResponse.redirect(appUrl(request, "/super-admin"));
}

function redirectToAdmin(request: NextRequest) {
  const slug = request.cookies.get("reservasi_restaurant_slug")?.value;
  const url = appUrl(request, "/admin");
  if (slug) url.searchParams.set("slug", slug);
  return NextResponse.redirect(url);
}

function appUrl(request: NextRequest, pathname: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "https";
  const proto = host.endsWith("amaniya.my.id") ? "https" : forwardedProto;
  return new URL(pathname, `${proto}://${host}`);
}

export const config = {
  matcher: ["/admin/:path*", "/super-admin/:path*", "/login"]
};
