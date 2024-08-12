import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { SchedulingType } from "@calcom/prisma/enums";

import { test, type Fixtures } from "./lib/fixtures";
import { bookTimeSlot, localize, selectFirstAvailableTimeSlotNextMonth } from "./lib/testUtils";

test.afterEach(async ({ users }) => {
  await users.deleteAll();
});

async function setupManagedEvent({
  users,
  unlockedFields,
}: {
  users: Fixtures["users"];
  unlockedFields?: Record<string, boolean>;
}) {
  const teamMateName = "teammate-1";
  const teamEventTitle = "Managed";
  const adminUser = await users.create(null, {
    hasTeam: true,
    teammates: [{ name: teamMateName }],
    teamEventTitle,
    teamEventSlug: "managed",
    schedulingType: "MANAGED",
    addManagedEventToTeamMates: true,
    managedEventUnlockedFields: unlockedFields,
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const memberUser = users.get().find((u) => u.name === teamMateName)!;
  const { team } = await adminUser.getFirstTeamMembership();
  const managedEvent = await adminUser.getFirstTeamEvent(team.id, SchedulingType.MANAGED);
  return { adminUser, memberUser, managedEvent, teamMateName, teamEventTitle };
}

const getByLocaleKey = async (page: Page, key: string) => page.getByText((await localize("en"))(key));

test.describe("Managed Event Types", () => {
  test("Can create managed event type", async ({ page, users }) => {
    // Creating the owner user of the team
    const adminUser = await users.create(null, {
      hasTeam: true,
      teammates: [{ name: "teammate-1" }],
    });
    // Creating the member user of the team
    // First we work with owner user, logging in
    await adminUser.apiLogin();
    // Let's create a team
    // Going to create an event type
    await page.goto("/event-types");
    await page.getByTestId("new-event-type").click();
    await page.getByTestId("option-team-1").click();
    // Expecting we can add a managed event type as team owner
    await expect(page.locator('button[value="MANAGED"]')).toBeVisible();

    // Actually creating a managed event type to test things further
    await page.click('button[value="MANAGED"]');
    await page.fill("[name=title]", "managed");
    await page.click("[type=submit]");

    await page.waitForURL("event-types/**");
    expect(page.url()).toContain("?tabName=team");
  });

  test("Managed event type has unlocked fields for admin", async ({ page, users }) => {
    const { adminUser, managedEvent } = await setupManagedEvent({ users });
    await adminUser.apiLogin();
    await page.goto(`/event-types/${managedEvent.id}?tabName=setup`);
    await page.getByTestId("update-eventtype").waitFor();
    await expect(page.locator('input[name="title"]')).toBeEditable();
    await expect(page.locator('input[name="slug"]')).toBeEditable();
    await expect(page.locator('input[name="length"]')).toBeEditable();
  });

  // test("Managed event option exists for team admin", async () => {});

  test("Managed event type exists for added member", async ({ page, users }) => {
    const { memberUser, teamEventTitle } = await setupManagedEvent({
      users,
    });
    await memberUser.apiLogin();
    await page.goto("/event-types");
    await expect(
      page.getByTestId("event-types").locator("div").filter({ hasText: teamEventTitle }).nth(1)
    ).toBeVisible();
  });

  test("Managed event type can use Organizer's default app as location", async ({ page, users }) => {
    const { adminUser, managedEvent } = await setupManagedEvent({
      users,
    });
    await adminUser.apiLogin();
    await page.goto(`/event-types/${managedEvent.id}?tabName=setup`);
    await page.locator("#location-select").click();
    const optionText = (await localize("en"))("organizer_default_conferencing_app");
    await page.locator(`text=${optionText}`).click();
    await page.locator("[data-testid=update-eventtype]").click();
    await page.getByTestId("vertical-tab-assignment").click();
    await gotoBookingPage(page);
    await selectFirstAvailableTimeSlotNextMonth(page);
    await bookTimeSlot(page);
    await expect(page.getByTestId("success-page")).toBeVisible();
  });

  test("Managed event type has locked fields for added member", async ({ page, users }) => {
    const { memberUser } = await setupManagedEvent({
      users,
    });
    await memberUser.apiLogin();
    const managedEvent = await memberUser.getFirstEventAsOwner();
    await page.goto(`/event-types/${managedEvent.id}?tabName=setup`);
    await page.waitForURL("event-types/**");

    await expect(page.locator('input[name="title"]')).not.toBeEditable();
    await expect(page.locator('input[name="slug"]')).not.toBeEditable();
    await expect(page.locator('input[name="length"]')).not.toBeEditable();
  });

  test("Managed event type provides discrete field lock/unlock state for admin", async ({ page, users }) => {
    const { adminUser, teamEventTitle } = await setupManagedEvent({ users });
    await adminUser.apiLogin();
    await page.goto("/event-types");

    await page.getByTestId("event-types").locator(`a[title="${teamEventTitle}"]`).click();
    await page.waitForURL("event-types/**");

    // Locked by default
    const titleLockIndicator = page.getByTestId("locked-indicator-title");
    await expect(titleLockIndicator).toBeVisible();
    await expect(titleLockIndicator.locator("[data-state='checked']")).toHaveCount(1);

    // Proceed to unlock and check that it got unlocked
    titleLockIndicator.click();
    await expect(titleLockIndicator.locator("[data-state='checked']")).toHaveCount(0);
    await expect(titleLockIndicator.locator("[data-state='unchecked']")).toHaveCount(1);

    // Save changes
    await page.locator('[type="submit"]').click();
    await expect(titleLockIndicator.locator("[data-state='unchecked']")).toHaveCount(1);
  });

  test("Managed event type shows discretionally unlocked field to member", async ({ page, users }) => {
    const { memberUser, teamEventTitle } = await setupManagedEvent({
      users,
      unlockedFields: {
        title: true,
      },
    });
    await memberUser.apiLogin();
    await page.goto("/event-types");
    await page.getByTestId("event-types").locator(`a[title="${teamEventTitle}"]`).click();
    await page.waitForURL("event-types/**");

    await expect(page.locator('input[name="title"]')).toBeEditable();
  });

  test("Managed event type should only update the unlocked fields modified by Admin", async ({
    page,
    users,
  }) => {
    const { adminUser, memberUser, teamEventTitle } = await setupManagedEvent({
      users,
      unlockedFields: {
        title: true,
      },
    });
    await memberUser.apiLogin();
    await page.goto("/event-types");

    await page.getByTestId("event-types").locator(`a[title="${teamEventTitle}"]`).click();
    await page.waitForURL("event-types/**");

    await expect(page.locator('input[name="title"]')).toBeEditable();
    await page.locator('input[name="title"]').fill(`Managed Event Title`);
    // Save changes
    await page.locator('[type="submit"]').click();
    await page.getByTestId("toast-success").waitFor();
    await page.waitForLoadState("networkidle");

    await page.goto("/auth/logout");

    await adminUser.apiLogin();
    await page.goto("/event-types");
    await page.getByTestId("event-types").locator(`a[title="${teamEventTitle}"]`).click();
    await page.waitForURL("event-types/**");

    await page.locator('input[name="length"]').fill(`45`);
    // Save changes
    await page.locator('[type="submit"]').click();
    await page.getByTestId("toast-success").waitFor();
    await page.waitForLoadState("networkidle");

    await page.goto("/auth/logout");

    await memberUser.apiLogin();
    await page.goto("/event-types");

    await page.getByTestId("event-types").locator('a[title="Managed Event Title"]').click();
    await page.waitForURL("event-types/**");

    //match length
    expect(await page.locator("[data-testid=duration]").getAttribute("value")).toBe("45");
    //ensure description didn't update
    expect(await page.locator(`input[name="title"]`).getAttribute("value")).toBe(`Managed Event Title`);
    await page.locator('input[name="title"]').fill(`managed`);
    // Save changes
    await page.locator('[type="submit"]').click();
    await page.getByTestId("toast-success").waitFor();
  });

  const MANAGED_EVENT_TABS: { slug: string; locator: (page: Page) => Locator | Promise<Locator> }[] = [
    { slug: "setup", locator: (page) => getByLocaleKey(page, "title") },
    {
      slug: "team",
      locator: (page) => getByLocaleKey(page, "automatically_add_all_team_members"),
    },
    {
      slug: "availability",
      locator: (page) => getByLocaleKey(page, "members_default_schedule_description"),
    },
    {
      slug: "limits",
      locator: (page) => getByLocaleKey(page, "before_event"),
    },
    {
      slug: "advanced",
      locator: (page) => getByLocaleKey(page, "event_name_in_calendar"),
    },
    {
      slug: "apps",
      locator: (page) => page.getByRole("heading", { name: "No apps installed" }),
    },
    {
      slug: "workflows",
      locator: (page) => page.getByTestId("empty-screen").getByRole("heading", { name: "Workflows" }),
    },
    {
      slug: "ai",
      locator: (page) => page.getByTestId("empty-screen").getByRole("heading", { name: "Cal.ai" }),
    },
  ];

  MANAGED_EVENT_TABS.forEach((tab) => {
    test(`Managed event can render "${tab.slug}" tab`, async ({ page, users }) => {
      const { adminUser, managedEvent } = await setupManagedEvent({ users });
      // First we work with owner user, logging in
      await adminUser.apiLogin();
      await page.goto(`/event-types/${managedEvent.id}?tabName=${tab.slug}`);
      await expect(await tab.locator(page)).toBeVisible();
    });
  });
});

async function gotoBookingPage(page: Page) {
  const previewLink = await page.getByTestId("preview-button").getAttribute("href");

  await page.goto(previewLink ?? "");
}
