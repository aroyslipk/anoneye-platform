import type { NextRequest } from "next/server";
import { apiError, apiJson, enforceRateLimit } from "@/lib/api/handler";
import { assertSameOrigin, readJsonBody } from "@/lib/security/request";
import { contactSchema } from "@/lib/api/validation";
import { getRepository } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "contact", 3, 60 * 60);
    const body = await readJsonBody(request, contactSchema, 8 * 1024);
    // Honeypot: return success without storing anything for bots.
    if (body.website && body.website.length > 0) return apiJson({ ok: true });
    const repo = getRepository();
    await repo.insertContactMessage({
      name: body.name,
      email: body.email.toLowerCase(),
      subject: body.subject,
      message: body.message,
    });
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
