import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders Bangla by default and keeps the English switch", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("পাবলিক প্রোফাইল দেখুন");
    await expect(page.getByText("শুধুমাত্র অফিসিয়াল Meta API")).toBeVisible();

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("See public profiles clearly");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("See public profiles clearly");
  });

  test("switches theme and persists the choice", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "EN", exact: true }).click();

    await page.getByRole("button", { name: "Toggle theme" }).click();
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark|light/);

    const isDark = (await html.getAttribute("class"))?.includes("dark") ?? false;
    await page.reload();
    await expect(html).toHaveClass(isDark ? /dark/ : /light/);
  });

  test("exposes skip navigation and honest capability copy", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /মূল কন্টেন্টে যান/ });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);

    // Capabilities that do not exist are described as unavailable, not sold.
    await expect(page.getByText(/প্রোফাইল ভিজিটর/).first()).toBeVisible();
    await expect(page.getByText(/বানানো সংখ্যা নেই/)).toBeVisible();
  });
});
