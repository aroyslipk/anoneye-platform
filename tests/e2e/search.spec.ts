import { expect, test } from "@playwright/test";

test.describe("search and demo profile", () => {
  test("finds the labelled demo fixture end-to-end", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("প্রোফাইল লিংক বা ইউজারনেম").fill("anoneye.demo");
    await page.getByLabel("প্ল্যাটফর্ম", { exact: true }).selectOption("instagram");
    await page.getByRole("button", { name: "প্রোফাইল খুঁজুন" }).click();

    await expect(page).toHaveURL(/\/profile\/instagram\/anoneye\.demo$/);
    await expect(page.getByText("Anoneye Demo Studio")).toBeVisible();
    await expect(page.getByText("ডেমো ফিক্সচার").first()).toBeVisible();
    await expect(page.getByText(/12480|12,480|১২,৪৮০/).first()).toBeVisible();

    await page.getByRole("link", { name: /মিডিয়া দেখুন/ }).click();
    await expect(page).toHaveURL(/\/media$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("পাবলিক মিডিয়া");
    await expect(page.locator("img").first()).toBeVisible();

    // No download affordance exists anywhere in the gallery.
    await expect(page.getByRole("button", { name: /ডাউনলোড/ })).toHaveCount(0);
    await expect(page.getByText(/ডাউনলোড বা প্রক্সি করে না/)).toBeVisible();
  });

  test("explains missing credentials instead of inventing a result", async ({ page }) => {
    await page.goto("/search?q=nasa&platform=instagram");
    await expect(page.getByText(/API ক্রেডেনশিয়াল প্রয়োজন|কনফিগার করা নেই/).first()).toBeVisible();
    await expect(page.getByText(/কিছুই অনুমান করে দেখানো হয়নি/)).toBeVisible();
  });

  test("rejects a post link as a profile input", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("প্রোফাইল লিংক বা ইউজারনেম").fill("https://www.instagram.com/p/Cabc123/");
    await page.getByRole("button", { name: "প্রোফাইল খুঁজুন" }).click();
    await expect(page.getByText(/পোস্ট, স্টোরি, রিল বা পেজের/)).toBeVisible();
    await expect(page).toHaveURL(/\/search/);
  });
});
