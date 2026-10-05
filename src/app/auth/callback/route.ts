import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/navigation";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: "/auth?error=The+sign-in+link+expired.+Please+try+again.",
      },
    });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: next },
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: "/auth?error=The+sign-in+link+expired.+Please+try+again.",
      },
    });
  }
  return response;
}
