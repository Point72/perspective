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

import { expect, test } from "@perspective-dev/test";
import {
    calibratePlotBaseline,
    gotoBasic,
    restoreChart,
    waitOneFrame,
} from "./helpers";

type Page = import("@playwright/test").Page;

async function schemaField(page: Page, key: string) {
    return await page.evaluate(async (key) => {
        const viewer = document.querySelector("perspective-viewer")!;
        const plugin = await (viewer as any).getPlugin();
        const saved = ((await (viewer as any).save()) as any).plugin_config;
        const schema = plugin.plugin_config_schema?.({}, saved) ?? {
            fields: [],
        };

        const flat: any[] = [];
        const walk = (fields: any[]) => {
            for (const f of fields) {
                if (f.kind === "Group") {
                    walk(f.fields);
                } else {
                    flat.push(f);
                }
            }
        };

        walk(schema.fields);
        return flat.find((f) => f.key === key) ?? null;
    }, key);
}

async function savedPluginConfig(page: Page) {
    return await page.evaluate(async () => {
        const viewer = document.querySelector("perspective-viewer")!;
        return ((await (viewer as any).save()) as any).plugin_config ?? {};
    });
}

async function settle(page: Page) {
    await waitOneFrame(page);
    await waitOneFrame(page);
}

test.describe("group_by_series", () => {
    test.beforeEach(async ({ page }) => {
        await gotoBasic(page);
    });

    for (const plugin of ["Y Bar", "X Bar", "Y Line", "Y Area"]) {
        test(`${plugin}: last_group_by matches the split_by rendering`, async ({
            page,
        }) => {
            await restoreChart(page, {
                plugin,
                columns: ["Sales"],
                group_by: ["Region"],
                split_by: ["Category"],
            } as never);
            await settle(page);
            const reference = await calibratePlotBaseline(page);

            await restoreChart(page, {
                plugin,
                columns: ["Sales"],
                group_by: ["Region", "Category"],
                split_by: [],
                plugin_config: { group_by_series: "last_group_by" },
            } as never);
            await settle(page);

            expect(await calibratePlotBaseline(page)).toEqual(reference);
        });
    }

    test("default split_by keeps the two-level group_by rendering", async ({
        page,
    }) => {
        const config = {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Region", "Category"],
        };

        await restoreChart(page, config as never);
        await settle(page);
        const nested = await calibratePlotBaseline(page);

        await restoreChart(page, {
            plugin_config: { group_by_series: "last_group_by" },
        } as never);
        await settle(page);
        const regrouped = await calibratePlotBaseline(page);
        expect(regrouped).not.toEqual(nested);

        await restoreChart(page, {
            plugin_config: { group_by_series: "split_by" },
        } as never);
        await settle(page);
        expect(await savedPluginConfig(page)).toEqual({});
        expect(await calibratePlotBaseline(page)).toEqual(nested);
    });

    test("a single group_by level renders as split_by", async ({ page }) => {
        await restoreChart(page, {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Region"],
        } as never);
        await settle(page);
        const plain = await calibratePlotBaseline(page);

        await restoreChart(page, {
            plugin_config: { group_by_series: "last_group_by" },
        } as never);
        await settle(page);

        expect(await savedPluginConfig(page)).toEqual({
            group_by_series: "last_group_by",
        });

        expect(await calibratePlotBaseline(page)).toEqual(plain);
    });

    test("last_group_by narrows facet_mode to grid and resets a stored one", async ({
        page,
    }) => {
        await restoreChart(page, {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Region", "Category"],
            split_by: ["Segment"],
            plugin_config: { facet_mode: "grid" },
        } as never);
        await settle(page);

        expect((await schemaField(page, "facet_mode")).variants).toHaveLength(2);

        await restoreChart(page, {
            plugin_config: { group_by_series: "last_group_by" },
        } as never);
        await settle(page);

        expect(await savedPluginConfig(page)).toEqual({
            group_by_series: "last_group_by",
        });

        const facet = await schemaField(page, "facet_mode");
        expect(facet.default).toEqual("grid");
        expect(facet.variants.map((v: any) => v.value)).toEqual(["grid"]);

        const error = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            try {
                await viewer.restore({
                    plugin_config: { facet_mode: "overlay" },
                } as any);
                return null;
            } catch (e: any) {
                return e.message ?? String(e);
            }
        });

        expect(error).toContain("Invalid `plugin_config.facet_mode`");
    });

    test("last_group_by with split_by facets by split_by", async ({ page }) => {
        await restoreChart(page, {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Region", "Category"],
            split_by: ["Segment"],
            plugin_config: { facet_mode: "grid" },
        } as never);
        await settle(page);
        const nestedFacets = await calibratePlotBaseline(page);

        await restoreChart(page, {
            plugin_config: { group_by_series: "last_group_by" },
        } as never);
        await settle(page);

        const regrouped = await calibratePlotBaseline(page);
        expect(regrouped).toBeGreaterThan(0);
        expect(regrouped).not.toEqual(nestedFacets);
    });
});
