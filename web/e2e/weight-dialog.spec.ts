import { test, expect } from "@playwright/test";
import { authenticatedContext } from "./helpers/auth";
import {
  seedTestUser,
  cleanupTrackingData,
  deleteTestUser,
} from "./helpers/db";

let userId: string;
let profileId: string;

test.beforeAll(async () => {
  const result = await seedTestUser();
  userId = result.userId;
  profileId = result.profileId;
});

test.afterAll(async () => {
  await deleteTestUser(userId);
});

test.afterEach(async () => {
  await cleanupTrackingData(profileId);
});

test.describe("Weight Dialog", () => {
  // Tests share DB state — must run serially in one worker
  test.describe.configure({ mode: "serial" });

  test("opens weight dialog from Ekle menu", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#weight")).toBeVisible();

    await context.close();
  });

  test("accepts comma as decimal separator", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();

    await page.locator("#weight").fill("82,5");
    await expect(page.getByRole("button", { name: "Kaydet" })).toBeEnabled();

    await context.close();
  });

  test("accepts period as decimal separator", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();

    await page.locator("#weight").fill("82.5");
    await expect(page.getByRole("button", { name: "Kaydet" })).toBeEnabled();

    await context.close();
  });

  test("saves weight entry", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();

    await page.locator("#weight").fill("75.5");
    await page.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("Kilo kaydedildi")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await context.close();
  });

  test("shows replace confirmation for same-day entry", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");

    // First entry
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();
    await page.locator("#weight").fill("75.5");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Kilo kaydedildi")).toBeVisible();

    // Second entry — same day
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();
    await page.locator("#weight").fill("76.0");
    await page.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("Bugün zaten kayıt var")).toBeVisible();
    await expect(page.getByRole("button", { name: "Değiştir" })).toBeVisible();

    await context.close();
  });

  test("replaces existing entry", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");

    // First entry
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();
    await page.locator("#weight").fill("75.5");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Kilo kaydedildi")).toBeVisible();

    // Second entry — triggers conflict
    await page.getByRole("button", { name: /Ekle/ }).click();
    await page.getByText("Kilo Ekle").click();
    await page.locator("#weight").fill("76.0");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Bugün zaten kayıt var")).toBeVisible();

    // Replace
    await page.getByRole("button", { name: "Değiştir" }).click();
    await expect(page.getByText("Kilo kaydedildi")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await context.close();
  });
});
