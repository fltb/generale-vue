import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { Tabs, Tab } from "../Tabs";

describe("Tabs", () => {
  it.each([
    ["default", false, "tabs"],
    ["bordered", true, "tabs-bordered"],
  ] as const)("%s state renders children and its expected class", (_name, bordered, expectedClass) => {
    render(() => <Tabs bordered={bordered}><Tab>Tab</Tab></Tabs>);
    expect(screen.getByText("Tab").parentElement).toHaveClass(expectedClass);
  });
});

describe("Tab", () => {
  it.each([
    ["default", false, "tab"],
    ["active", true, "tab-active"],
  ] as const)("%s state renders its expected class", (_name, active, expectedClass) => {
    render(() => <Tab active={active} href="/">Tab</Tab>);
    expect(screen.getByRole("link", { name: "Tab" })).toHaveClass(expectedClass);
  });

  it("calls onClick", () => {
    const handle = vi.fn((event: MouseEvent) => event.preventDefault());
    render(() => <Tab href="#" onClick={handle}>Click</Tab>);
    fireEvent.click(screen.getByRole("link", { name: "Click" }));
    expect(handle).toHaveBeenCalled();
  });
});
