import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { readJsonBody, assertSameOrigin } from "@/lib/security/request";
import { signUpSchema } from "@/lib/api/validation";
import { signUpWithPassword, AuthServiceError } from "@/lib/auth/service";
import { AppError } from "@/lib/errors";

function mapAuthError(error: unknown): never {
  if (error instanceof AuthServiceError) {
    const status =
      error.code === "email_taken"
        ? 409
        : error.code === "weak_password"
          ? 400
          : error.code === "rate_limited"
            ? 429
            : error.code === "not_configured"
              ? 503
              : 400;
    throw new AppError(
      error.code === "not_configured"
        ? "not_configured"
        : error.code === "email_taken"
          ? "conflict"
          : error.code === "rate_limited"
            ? "rate_limited"
            : "invalid_input",
      status,
      error.message,
    );
  }
  throw error;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "auth-signup", 8, 15 * 60);
    const body = await readJsonBody(request, signUpSchema, 8 * 1024);
    const result = await signUpWithPassword(body.email, body.password, body.displayName).catch(mapAuthError);
    return apiJson({
      ok: true,
      user: result.user ? { id: result.user.id, email: result.user.email } : undefined,
      requiresEmailConfirmation: result.requiresEmailConfirmation ?? false,
      message: result.message,
    });
  } catch (error) {
    return apiError(error);
  }
}
