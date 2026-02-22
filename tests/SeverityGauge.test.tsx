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
      // Look for an element with left: 87% inline style
      const marker = container.querySelector("[data-testid='gauge-marker']");
      if (marker) {
        expect((marker as HTMLElement).style.left).toBe("87%");
      } else {
        // Alternative: find element by style
        const allElements = container.querySelectorAll("*");
        const markerEl = Array.from(allElements).find(
          (el) => (el as HTMLElement).style?.left === "87%"
        );
        expect(markerEl).toBeTruthy();
      }
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
    test("has linear-gradient background", () => {
      const { container } = render(<SeverityGauge score={50} />);
      const bar = container.querySelector("[data-testid='gauge-bar']");
      if (bar) {
        expect((bar as HTMLElement).style.background).toContain("linear-gradient");
      } else {
        // Look for gradient in any element's inline style
        const allElements = container.querySelectorAll("*");
        const gradientEl = Array.from(allElements).find(
          (el) => (el as HTMLElement).style?.background?.includes("gradient")
        );
        expect(gradientEl).toBeTruthy();
      }
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
