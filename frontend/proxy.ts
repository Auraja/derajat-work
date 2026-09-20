import { NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth-routes";

const SESSION_COOKIES = ["access_token", "session", "derajat_session"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
  if (isProtectedPath(pathname) && !authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
