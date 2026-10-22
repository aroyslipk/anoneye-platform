import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("legal pages render Bangla and expose the draft notice", async ({ page }) => {
    for (const path of ["/privacy", "/terms"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/খসড়া|আইনি পরামর্শ নয়/).first()).toBeVisible();
    }
  });

  test("contact form explains that delivery is not configured", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByLabel(/নাম/).fill("Test Person");
    await page.getByLabel(/ইমেইল/).fill("person@example.com");
    await page.getByLabel(/বিষয়/).fill("Integration question");
    await page.getByLabel(/বার্তা/).fill("This is a test message long enough to pass validation.");
    await page.getByRole("button", { name: /বার্তা পাঠান/ }).click();
    // Either it is stored (local backend) or the UI explains why it cannot be.
    await expect(page.getByText(/পাঠানো হয়েছে|পাঠানো যায়নি|কনফিগার/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows a branded not-found page without leaking internals", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: /হোম|প্রধান পাতা|ফিরুন/ }).first()).toBeVisible();
  });

  test("manifest, robots and sitemap are served", async ({ request }) => {
    for (const path of ["/manifest.webmanifest", "/robots.txt", "/sitemap.xml"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
    }
  });
});
