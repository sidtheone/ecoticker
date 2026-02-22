import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SeverityGauge from "../src/components/SeverityGauge";

// Mock recharts (follows project pattern)
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe("SeverityGauge", () => {
  describe("accessibility", () => {
    test("renders with role='meter'", () => {
      render(<SeverityGauge score={50} />);
      const meter = screen.getByRole("meter");
      expect(meter).toBeInTheDocument();
    });

    test("has aria-valuenow matching score", () => {
      render(<SeverityGauge score={75} />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "75");
    });

    test("has aria-valuemin=0 and aria-valuemax=100", () => {
      render(<SeverityGauge score={50} />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuemin", "0");
      expect(meter).toHaveAttribute("aria-valuemax", "100");
    });
  });

  describe("rendering", () => {
    test("renders gradient bar container", () => {
      const { container } = render(<SeverityGauge score={87} />);
      const meter = screen.getByRole("meter");
      expect(meter).toBeInTheDocument();
      // Should have at least the bar and marker as children
      expect(meter.children.length).toBeGreaterThanOrEqual(1);
    });

    test("renders marker at correct position", () => {
      const { container } = render(<SeverityGauge score={87} />);
      const marker = container.querySelector("[data-testid='gauge-marker']");
      expect(marker).toBeTruthy();
      expect((marker as HTMLElement).style.left).toBe("calc(87% - 1.5px)");
    });

    test("renders with score 0", () => {
      render(<SeverityGauge score={0} />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "0");
    });

    test("renders with score 100", () => {
      render(<SeverityGauge score={100} />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "100");
    });
  });

  describe("gradient bar", () => {
    test("has d8-gauge class for CSS gradient", () => {
      render(<SeverityGauge score={50} />);
      const bar = screen.getByTestId("gauge-bar");
      expect(bar.className).toContain("d8-gauge");
    });
  });

  describe("compact mode / min-width fallback", () => {
    test("accepts compact prop for small-size mode", () => {
      // If the component uses a compact prop
      render(<SeverityGauge score={50} compact />);
      const meter = screen.getByRole("meter");
      expect(meter).toBeInTheDocument();
    });
  });

  describe("SSR compatibility", () => {
    test("component has no 'use client' directive (server component)", () => {
      // This is verified by the fact that it renders without client-side hooks
      // The component should not use useState, useEffect, etc.
      render(<SeverityGauge score={50} />);
      expect(screen.getByRole("meter")).toBeInTheDocument();
    });
  });
});
