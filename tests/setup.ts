import { afterEach } from "vitest";
import { closeLocalDbForTests } from "@/lib/db/local";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

// Every test starts with an empty in-memory database and empty rate-limit state.
afterEach(() => {
  closeLocalDbForTests();
  resetRateLimitsForTests();
});
