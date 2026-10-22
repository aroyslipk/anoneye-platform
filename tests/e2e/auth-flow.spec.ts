import { expect, test } from "@playwright/test";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("ইমেইল ঠিকানা").fill(email);
  await page.getByLabel("পাসওয়ার্ড").fill("password123");
  await page.getByRole("button", { name: "অ্যাকাউন্ট খুলুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("account and tracking flow", () => {
  test("protected routes redirect to sign-in with a safe next path", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/tracked", "/dashboard/reports", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Anoneye-তে সাইন ইন করুন");
    }
  });

  test("signs up, tracks the demo profile and opens a report", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await expect(page.getByText(email).first()).toBeVisible();

    // Track the demo fixture from its public profile.
    await page.goto("/profile/instagram/anoneye.demo");
    await page.getByRole("button", { name: "ট্র্যাক করা প্রোফাইলে সেভ করুন" }).click();
    await expect(page.getByText("ট্র্যাক করা প্রোফাইলে সেভ হয়েছে")).toBeVisible({ timeout: 20_000 });

    // The tracked list shows the row that was just created.
    await page.goto("/dashboard/tracked");
    await expect(page.locator('a[href="/profile/instagram/anoneye.demo"]').first()).toBeVisible();
    await expect(page.getByText("সফল")).toHaveCount(0); // status labels must be human-readable, not raw codes
    await expect(page.getByText(/হালনাগাদ|সিঙ্ক/).first()).toBeVisible();

    // Reports are built from stored snapshots and expose a CSV download.
    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("অ্যানালিটিক্স ও রিপোর্ট");
    await expect(page.locator('a[href^="/api/reports/export"]').first()).toHaveAttribute("href", /tracked=/);
    await expect(page.getByText("কভারেজ")).toBeVisible();
  });

  test("rejects a wrong password without revealing account existence", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ইমেইল ঠিকানা").fill("nobody@example.com");
    await page.getByLabel("পাসওয়ার্ড").fill("wrong-password");
    await page.getByRole("button", { name: "সাইন ইন" }).click();
    await expect(page.getByText("ইমেইল বা পাসওয়ার্ড ভুল।")).toBeVisible();
  });

  test("signs out and protects the dashboard again", async ({ page }) => {
    await signUp(page, uniqueEmail());
    await page.getByRole("button", { name: "সাইন আউট" }).first().click();
    await page.waitForURL(/\/login|\/$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
