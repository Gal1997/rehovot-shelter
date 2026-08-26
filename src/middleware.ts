import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "./lib/session";

function secret() {
  const value = process.env.AUTH_SECRET || "";
  return new TextEncoder().encode(value);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicPath =
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/_next") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let signedIn = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, secret());
      signedIn = true;
    } catch {
      signedIn = false;
    }
  }

  if (!signedIn && !publicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "יש להתחבר כדי להמשיך" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (signedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
