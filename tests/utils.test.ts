import { urgencyColor, changeColor, formatChange, scoreToUrgency } from "../src/lib/utils";

describe("urgencyColor", () => {
  test("breaking returns red", () => {
    const c = urgencyColor("breaking");
    expect(c.text).toContain("red");
    expect(c.bg).toContain("red");
  });

  test("critical returns orange", () => {
    expect(urgencyColor("critical").text).toContain("orange");
  });

  test("moderate returns yellow", () => {
    expect(urgencyColor("moderate").text).toContain("yellow");
  });

  test("informational returns green", () => {
    expect(urgencyColor("informational").text).toContain("green");
  });
});

describe("changeColor", () => {
  test("positive change (worsening) is red", () => {
    expect(changeColor(10)).toBe("text-red-400");
  });

  test("negative change (improving) is green", () => {
    expect(changeColor(-5)).toBe("text-green-400");
  });

  test("zero change is gray", () => {
    expect(changeColor(0)).toBe("text-gray-400");
  });
});

describe("formatChange", () => {
  test("positive shows + and up arrow", () => {
    expect(formatChange(13)).toBe("+13 ▲");
  });

  test("negative shows number and down arrow", () => {
    expect(formatChange(-5)).toBe("-5 ▼");
  });

  test("zero shows dash", () => {
    expect(formatChange(0)).toBe("0 ─");
  });
});

describe("scoreToUrgency", () => {
  test("80-100 is breaking", () => {
    expect(scoreToUrgency(80)).toBe("breaking");
    expect(scoreToUrgency(100)).toBe("breaking");
  });

  test("60-79 is critical", () => {
    expect(scoreToUrgency(60)).toBe("critical");
    expect(scoreToUrgency(79)).toBe("critical");
  });

  test("30-59 is moderate", () => {
    expect(scoreToUrgency(30)).toBe("moderate");
    expect(scoreToUrgency(59)).toBe("moderate");
  });

  test("0-29 is informational", () => {
    expect(scoreToUrgency(0)).toBe("informational");
    expect(scoreToUrgency(29)).toBe("informational");
  });
});
