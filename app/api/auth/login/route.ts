import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin, readJsonBody } from "@/lib/security/request";
import { signInSchema } from "@/lib/api/validation";
import { signInWithPassword, AuthServiceError } from "@/lib/auth/service";
import { AppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "auth-login", 10, 15 * 60);
    const body = await readJsonBody(request, signInSchema, 8 * 1024);
    const result = await signInWithPassword(body.email, body.password).catch((error: unknown) => {
      if (error instanceof AuthServiceError) {
        const status =
          error.code === "not_configured"
            ? 503
            : error.code === "rate_limited"
              ? 429
              : error.code === "email_not_confirmed"
                ? 403
                : 401;
        throw new AppError(
          error.code === "not_configured"
            ? "not_configured"
            : error.code === "rate_limited"
              ? "rate_limited"
              : "unauthorized",
          status,
          error.message,
        );
      }
      throw error;
    });
    return apiJson({
      ok: true,
      user: result.user ? { id: result.user.id, email: result.user.email } : undefined,
    });
  } catch (error) {
    return apiError(error);
  }
}
