// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import { test, expect, PageView } from "../helpers.ts";
import type { Locator, Page } from "@playwright/test";

const TAG = "perspective-viewer-debug-siblings";

test.beforeEach(async ({ page }) => {
    await page.goto("/rust/perspective-viewer/test/html/superstore-debug.html");
    await page.evaluate(async () => {
        while (!(window as any)["__TEST_PERSPECTIVE_READY__"]) {
            await new Promise((x) => setTimeout(x, 10));
        }
    });
});

async function saved(page: Page): Promise<Record<string, unknown>> {
    return await page.evaluate(async () => {
        const viewer = document.querySelector("perspective-viewer")!;
        await viewer.flush();
        return ((await viewer.save()) as any).plugin_config;
    });
}

async function delivered(page: Page): Promise<Record<string, unknown>> {
    return await page.evaluate(async (tag) => {
        const viewer = document.querySelector("perspective-viewer")!;
        await viewer.flush();
        return (viewer.querySelector(tag) as any)._restored_plugin_config;
    }, TAG);
}

async function restoreError(
    page: Page,
    plugin_config: Record<string, unknown>,
): Promise<string | null> {
    return await page.evaluate(async (plugin_config) => {
        const viewer = document.querySelector("perspective-viewer")!;
        try {
            await viewer.restore({ plugin_config } as any);
            return null;
        } catch (e: any) {
            return e.message ?? String(e);
        }
    }, plugin_config);
}

function pluginTab(view: PageView): Locator {
    return view.container.locator("#plugin-tab");
}

function select(view: PageView, key: string): Locator {
    return pluginTab(view).locator(`#${key}-label + div select`);
}

test.describe("reset_siblings via restore()", () => {
    test("changing the field resets a stored sibling", async ({ page }) => {
        const view = new PageView(page);
        await view.restore({
            plugin: "Debug Siblings",
            plugin_config: { facet_mode: "grid", legend_on: true },
        });

        expect(await saved(page)).toEqual({
            facet_mode: "grid",
            legend_on: true,
        });

        await view.restore({
            plugin_config: { group_by_series: "last_group_by" },
        });

        expect(await saved(page)).toEqual({
            group_by_series: "last_group_by",
            legend_on: true,
        });

        expect((await delivered(page)).facet_mode).toBeUndefined();
    });

    test("a stored choice the narrowed schema rejects is reset, not an error", async ({
        page,
    }) => {
        const view = new PageView(page);
        await view.restore({
            plugin: "Debug Siblings",
            plugin_config: { facet_mode: "grid" },
        });

        expect(
            await restoreError(page, { group_by_series: "last_group_by" }),
        ).toBeNull();

        expect(
            await restoreError(page, { group_by_series: "split_by" }),
        ).toBeNull();

        expect(await saved(page)).toEqual({});
        expect((await delivered(page)).facet_mode).toBeUndefined();
    });

    test("a sibling set in the same update is kept", async ({ page }) => {
        const view = new PageView(page);
        await view.restore({ plugin: "Debug Siblings" });
        await view.restore({
            plugin_config: {
                group_by_series: "last_group_by",
                facet_mode: "grid",
            },
        });

        expect(await saved(page)).toEqual({ group_by_series: "last_group_by" });
        expect((await delivered(page)).facet_mode).toBeUndefined();
    });

    test("a sibling the narrowed schema rejects in the same update errors", async ({
        page,
    }) => {
        const view = new PageView(page);
        await view.restore({ plugin: "Debug Siblings" });
        const error = await restoreError(page, {
            group_by_series: "last_group_by",
            facet_mode: "overlay",
        });

        expect(error).toContain("Invalid `plugin_config.facet_mode`");
        expect(await saved(page)).toEqual({});
    });

    test("re-setting the current value resets nothing", async ({ page }) => {
        const view = new PageView(page);
        await view.restore({
            plugin: "Debug Siblings",
            plugin_config: { facet_mode: "grid" },
        });

        await view.restore({ plugin_config: { group_by_series: "split_by" } });
        expect(await saved(page)).toEqual({ facet_mode: "grid" });
    });

    test("updating an unrelated field resets nothing", async ({ page }) => {
        const view = new PageView(page);
        await view.restore({
            plugin: "Debug Siblings",
            plugin_config: { facet_mode: "grid" },
        });

        await view.restore({ plugin_config: { legend_on: true } });
        expect(await saved(page)).toEqual({
            facet_mode: "grid",
            legend_on: true,
        });
    });
});

test.describe("reset_siblings via the plugin tab", () => {
    test("selecting a new value resets the sibling", async ({ page }) => {
        const view = new PageView(page);
        await view.restore({
            settings: true,
            plugin: "Debug Siblings",
            plugin_config: { facet_mode: "grid" },
        });

        await view.container.locator("#plugin_tabbar_tab").click();
        await pluginTab(view).waitFor({ state: "visible" });
        await expect(select(view, "facet_mode")).toHaveValue("grid");

        await select(view, "group_by_series").selectOption("last_group_by");
        await expect.poll(() => saved(page)).toEqual({
            group_by_series: "last_group_by",
        });

        await expect(select(view, "facet_mode").locator("option")).toHaveText([
            "grid",
        ]);
        await expect(select(view, "facet_mode")).toHaveValue("grid");
        expect((await delivered(page)).facet_mode).toBeUndefined();
    });
});
