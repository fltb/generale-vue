import { describe, expect, it } from "vitest";
import { ITEM_DISPLAY, ITEM_ORDER, itemAccentCss, itemAccentNumber } from "../itemDisplay";

describe("itemDisplay registry", () => {
	it("covers exactly the ITEM_ORDER set", () => {
		const keys = Object.keys(ITEM_DISPLAY).sort();
		expect(keys).toEqual([...ITEM_ORDER].sort());
		expect(keys).toHaveLength(9);
	});

	it("has unique accents within each palette", () => {
		const accents = ITEM_ORDER.map((t) => ITEM_DISPLAY[t].accent);
		expect(new Set(accents).size).toBe(accents.length);
		const safeAccents = ITEM_ORDER.map((t) => ITEM_DISPLAY[t].accentSafe);
		expect(new Set(safeAccents).size).toBe(safeAccents.length);
	});

	it("has unique labels", () => {
		const labels = ITEM_ORDER.map((t) => ITEM_DISPLAY[t].label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it("converts accents to pixi numbers per palette", () => {
		expect(itemAccentNumber("BOMB_UP", "default")).toBe(0xff4444);
		expect(itemAccentNumber("BOMB_UP", "safe")).toBe(0xe69f00);
		expect(itemAccentCss("PIERCE", "safe")).toBe("#FFFFFF");
	});
});
