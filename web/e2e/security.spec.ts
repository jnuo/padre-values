import { test, expect } from "@playwright/test";
import { authenticatedContext } from "./helpers/auth";
import { seedTestUser, deleteTestUser } from "./helpers/db";

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

test.describe("Security", () => {
  test.describe.configure({ mode: "serial" });

  test("authenticated user can access dashboard", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    // Dashboard should render content (not redirect away)
    await expect(page.locator("main")).toBeVisible();

    await context.close();
  });

  test("unauthenticated user is redirected to login", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test("fake PDF is rejected with Turkish error", async ({ browser }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    await page.goto("/upload");

    // Wait for profile selector to load, then explicitly select to ensure state is set
    const profileSelect = page.getByRole("combobox", { name: "Profil" });
    await expect(profileSelect).toBeVisible();
    await profileSelect.click();
    await page.getByRole("option", { name: "E2E Test Profile" }).click();

    // Create a fake PDF: text content with .pdf extension
    const fakeBuffer = Buffer.from("this is not a real pdf file");

    await page.locator('input[type="file"]').setInputFiles({
      name: "fake-report.pdf",
      mimeType: "application/pdf",
      buffer: fakeBuffer,
    });

    // The server should reject it and show Turkish error message
    await expect(page.getByText("Geçersiz PDF dosyası")).toBeVisible({
      timeout: 10000,
    });

    await context.close();
  });

  test("API error responses do not leak internal details", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedContext(
      browser,
      userId,
      profileId,
    );

    // Hit a non-existent upload ID — should return an error without a details field
    const response = await page.request.get(
      "/api/upload/00000000-0000-0000-0000-000000000000",
    );
    const body = await response.json();

    expect(body).not.toHaveProperty("details");

    // Also check the upload POST with missing file
    const postResponse = await page.request.post("/api/upload", {
      multipart: {
        profileId: profileId,
      },
    });
    const postBody = await postResponse.json();

    expect(postBody).not.toHaveProperty("details");
    expect(postResponse.status()).toBe(400);

    await context.close();
  });
});
