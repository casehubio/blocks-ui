import { test, expect } from "@playwright/test";

async function navigateToPage(page: import("@playwright/test").Page, pageTitle: string) {
  await page.goto("/");
  await page.waitForSelector("blocks-example-shell", { state: "attached" });
  const navBtn = page.locator(`button.nav-item:has-text("${pageTitle}")`);
  await navBtn.click();
  await page.waitForTimeout(500);
}

test.describe("BlocksTimeline — CaseHub domain", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, "Timeline (Events)");
  });

  test("renders vertical timeline with case events", async ({ page }) => {
    const timeline = page.locator("blocks-timeline");
    await expect(timeline).toBeAttached();

    const nodes = timeline.locator("[role='listitem']");
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("renders filter bar with stream types", async ({ page }) => {
    const timeline = page.locator("blocks-timeline");
    const filterChips = timeline.locator(".filter-chip");
    const count = await filterChips.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("renders category-coloured event badges", async ({ page }) => {
    const timeline = page.locator("blocks-timeline");
    const badges = timeline.locator("[role='listitem'] span[style]");
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("toggles to compact mode", async ({ page }) => {
    await page.getByRole("button", { name: "Mode: Full" }).click();
    const timeline = page.locator("blocks-timeline");
    const strip = timeline.locator(".compact-strip");
    await expect(strip).toBeAttached();
  });

  test("inherits ARIA from PagesEventTimeline", async ({ page }) => {
    const timeline = page.locator("blocks-timeline");
    await expect(timeline).toHaveAttribute("role", "region");
    await expect(timeline).toHaveAttribute("aria-label", "Event timeline");
  });
});
