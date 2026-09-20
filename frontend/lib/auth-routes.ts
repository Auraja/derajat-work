const PUBLIC_PREFIXES = ["/login", "/api", "/_next", "/favicon.ico"];

export function isProtectedPath(pathname: string): boolean {
  return !PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function safeNextPath(value: string | null): string {
  const unsafeCharacter = /[\\\u0000-\u001f\u007f-\u009f]/;
  return value?.startsWith("/") && !value.startsWith("//") && !unsafeCharacter.test(value)
    ? value
    : "/dashboard";
}
