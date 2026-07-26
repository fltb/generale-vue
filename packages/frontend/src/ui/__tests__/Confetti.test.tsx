import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import Confetti from "../Confetti";

describe("Confetti", () => {
  it.each([
    ["default", undefined, 80],
    ["custom", 20, 20],
  ] as const)("%s count renders the requested pieces", (_name, count, expectedCount) => {
    const { container } = render(() => <Confetti count={count} />);
    expect(container.firstElementChild).toBeInTheDocument();
    expect(container.firstElementChild?.children).toHaveLength(expectedCount);
  });
});
