import type { NextRequest } from "next/server";
import { connection, NextResponse } from "next/server";
import { apiError, enforceRateLimit } from "@/lib/api/handler";
import { getRepository, requireApiUser } from "@/lib/auth/session";

/** Export everything Anoneye stores about the user, excluding secret ciphertext. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const user = await requireApiUser();
    enforceRateLimit(request, "account-export", 5, 60, user.id);
    const repo = getRepository();
    const data = await repo.exportUserData(user.id);
    const payload = JSON.stringify({ user: { id: user.id, email: user.email }, data }, null, 2);
    return new NextResponse(payload, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="anoneye-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
