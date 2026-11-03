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

import type { ColumnData, ColumnDataMap } from "./view-reader";
import { synthesizeStringLevel } from "../charts/common/category-axis-resolver";
import type { DateFormatModifiers } from "@perspective-dev/viewer/column-format";

export interface LastGroupBySplit {
    columns: ColumnDataMap;

    numRows: number;

    groupBy: string[];

    values: string[];

    sourceRow: Int32Array;

    prefixes: Map<string, { value: number; facet: string }>;
}

export function lastGroupBySplit(
    columns: ColumnDataMap,
    numRows: number,
    groupBy: string[],
    levelTypes: string[],
    dateModifiers?: DateFormatModifiers,
): LastGroupBySplit | null {
    const L = groupBy.length;
    if (L < 2) {
        return null;
    }

    const lastName = `__ROW_PATH_${L - 1}__`;
    const last = columns.get(lastName);
    if (!last) {
        return null;
    }

    const lastLevel = toStringLevel(last, numRows, levelTypes[L - 1], dateModifiers);
    const leading: { indices: Int32Array; dictionary: string[] }[] = [];
    for (let n = 0; n < L - 1; n++) {
        const col = columns.get(`__ROW_PATH_${n}__`);
        if (!col) {
            return null;
        }

        leading.push(toStringLevel(col, numRows, levelTypes[n], dateModifiers));
    }

    const categoryOf = new Int32Array(numRows);
    const firstRowOf: number[] = [];
    const keyToCategory = new Map<string, number>();
    for (let r = 0; r < numRows; r++) {
        let key = "";
        for (const level of leading) {
            key += `${level.indices[r]}\u0000`;
        }

        let c = keyToCategory.get(key);
        if (c === undefined) {
            c = firstRowOf.length;
            keyToCategory.set(key, c);
            firstRowOf.push(r);
        }

        categoryOf[r] = c;
    }

    const values: string[] = [];
    const valueOf = new Int32Array(numRows);
    const labelToValue = new Map<string, number>();
    for (let r = 0; r < numRows; r++) {
        const label = lastLevel.dictionary[lastLevel.indices[r]] ?? "";
        let v = labelToValue.get(label);
        if (v === undefined) {
            v = values.length;
            labelToValue.set(label, v);
            values.push(label);
        }

        valueOf[r] = v;
    }

    const C = firstRowOf.length;
    const V = values.length;
    const sourceRow = new Int32Array(C * V).fill(-1);
    for (let r = 0; r < numRows; r++) {
        const idx = categoryOf[r] * V + valueOf[r];
        if (sourceRow[idx] === -1) {
            sourceRow[idx] = r;
        }
    }

    const out: ColumnDataMap = new Map();
    const prefixes = new Map<string, { value: number; facet: string }>();
    for (let n = 0; n < L - 1; n++) {
        const name = `__ROW_PATH_${n}__`;
        out.set(name, gatherRows(columns.get(name)!, firstRowOf));
    }

    for (const [name, col] of columns) {
        if (name.startsWith("__")) {
            continue;
        }

        const pipe = name.lastIndexOf("|");
        const splitPrefix = pipe === -1 ? "" : name.substring(0, pipe);
        const base = pipe === -1 ? name : name.substring(pipe + 1);
        for (let v = 0; v < V; v++) {
            const rows = new Int32Array(C);
            for (let c = 0; c < C; c++) {
                rows[c] = sourceRow[c * V + v];
            }

            const prefix =
                splitPrefix === "" ? values[v] : `${splitPrefix}|${values[v]}`;
            out.set(`${prefix}|${base}`, gatherRows(col, rows));
            prefixes.set(prefix, { value: v, facet: splitPrefix });
        }
    }

    return {
        columns: out,
        numRows: C,
        groupBy: groupBy.slice(0, L - 1),
        values,
        sourceRow,
        prefixes,
    };
}

function toStringLevel(
    col: ColumnData,
    numRows: number,
    levelType: string | undefined,
    dateModifiers?: DateFormatModifiers,
): { indices: Int32Array; dictionary: string[] } {
    if (col.type === "string" && col.indices && col.dictionary) {
        return { indices: col.indices, dictionary: col.dictionary };
    }

    return synthesizeStringLevel(col, numRows, levelType ?? "string", dateModifiers);
}

function gatherRows(col: ColumnData, rows: ArrayLike<number>): ColumnData {
    const n = rows.length;
    const valid = new Uint8Array((n + 7) >> 3);
    const srcValid = col.valid;
    for (let i = 0; i < n; i++) {
        const r = rows[i];
        if (r < 0) {
            continue;
        }

        if (srcValid && !((srcValid[r >> 3] >> (r & 7)) & 1)) {
            continue;
        }

        valid[i >> 3] |= 1 << (i & 7);
    }

    if (col.type === "string") {
        const src = col.indices!;
        const indices = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            indices[i] = rows[i] < 0 ? 0 : src[rows[i]];
        }

        return { type: "string", indices, dictionary: col.dictionary, valid };
    }

    const src = col.values!;
    const values = new (src.constructor as
        | Float32ArrayConstructor
        | Float64ArrayConstructor
        | Int32ArrayConstructor)(n);

    for (let i = 0; i < n; i++) {
        values[i] = rows[i] < 0 ? 0 : src[rows[i]];
    }

    return { type: col.type, values, valid };
}
