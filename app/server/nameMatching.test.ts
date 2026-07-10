import { describe, it, expect } from "vitest";
import {
  scoreMatch,
  areNicknames,
  editDistance,
  lastNamesMatch,
  firstNameRelation,
  isGenericEmailDomain,
} from "./nameMatching.ts";

const reg = (fullName: string, email: string | null = null) => ({ fullName, email });
const mem = (firstName: string, lastName: string, email: string | null = null) => ({ firstName, lastName, email });

describe("editDistance", () => {
  it("computes standard distances", () => {
    expect(editDistance("smith", "smith")).toBe(0);
    expect(editDistance("smith", "smyth")).toBe(1);
    expect(editDistance("smith", "smithe")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("early-exits past the cap", () => {
    expect(editDistance("abcdef", "zzzzzz", 2)).toBeGreaterThan(2);
  });
});

describe("areNicknames", () => {
  it("recognizes common nickname pairs", () => {
    expect(areNicknames("bob", "robert")).toBe(true);
    expect(areNicknames("liz", "elizabeth")).toBe(true);
    expect(areNicknames("bill", "william")).toBe(true);
  });

  it("rejects unrelated names", () => {
    expect(areNicknames("bob", "william")).toBe(false);
    expect(areNicknames("xyz", "robert")).toBe(false);
  });
});

describe("lastNamesMatch / firstNameRelation", () => {
  it("tolerates small last-name typos on longer names only", () => {
    expect(lastNamesMatch("smith", "smyth")).toEqual({ match: true, exact: false });
    expect(lastNamesMatch("lee", "les").match).toBe(false);
  });

  it("classifies first-name relations", () => {
    expect(firstNameRelation("bob", "robert")).toBe("nickname");
    expect(firstNameRelation("jhon", "john")).toBe("typo");
    expect(firstNameRelation("mary", "susan")).toBe("none");
  });
});

describe("isGenericEmailDomain", () => {
  it("flags free providers and passes custom domains", () => {
    expect(isGenericEmailDomain("gmail.com")).toBe(true);
    expect(isGenericEmailDomain("smithfamily.net")).toBe(false);
  });
});

describe("scoreMatch", () => {
  it("keeps exact email/name matches as exact matches", () => {
    expect(scoreMatch(reg("Bob Smith", "bob@x.com"), mem("Robert", "Smith", "bob@x.com"))).toMatchObject({
      matchType: "exact",
      matchedOn: "email",
    });
    expect(scoreMatch(reg("  Robert   Smith "), mem("Robert", "Smith"))).toMatchObject({
      matchType: "exact",
      matchedOn: "name",
    });
    expect(scoreMatch(reg("Robert Smith", "bob@x.com"), mem("Robert", "Smith", "BOB@X.COM"))).toMatchObject({
      matchType: "exact",
      matchedOn: "email and name",
    });
  });

  it("suggests nickname matches as close", () => {
    expect(scoreMatch(reg("Bob Smith"), mem("Robert", "Smith"))).toMatchObject({
      matchType: "close",
      matchedOn: "nickname",
    });
  });

  it("suggests small-typo matches as close", () => {
    expect(scoreMatch(reg("Jhon Smith"), mem("John", "Smith"))).toMatchObject({
      matchType: "close",
      matchedOn: "similar name",
    });
    expect(scoreMatch(reg("Robert Smyth"), mem("Robert", "Smith"))).toMatchObject({
      matchType: "close",
      matchedOn: "similar name",
    });
  });

  it("suggests last name + shared custom email domain as close", () => {
    expect(
      scoreMatch(reg("Carol Smith", "carol@smithhouse.net"), mem("Margaret", "Smith", "meg@smithhouse.net")),
    ).toMatchObject({ matchType: "close", matchedOn: "last name and email domain" });
  });

  it("does not use generic email domains as a signal", () => {
    expect(scoreMatch(reg("Carol Smith", "carol@gmail.com"), mem("Margaret", "Smith", "meg@gmail.com"))).toBeNull();
  });

  it("returns null for unrelated people", () => {
    expect(scoreMatch(reg("Alice Jones"), mem("Robert", "Smith"))).toBeNull();
    expect(scoreMatch(reg("Bob Smith"), mem("Robert", "Johnson"))).toBeNull();
  });

  it("ranks exact above close", () => {
    const exact = scoreMatch(reg("Robert Smith"), mem("Robert", "Smith"))!;
    const close = scoreMatch(reg("Bob Smith"), mem("Robert", "Smith"))!;
    expect(exact.score).toBeGreaterThan(close.score);
  });

  it("handles single-word registration names without fuzzy matching", () => {
    expect(scoreMatch(reg("Bob"), mem("Robert", "Smith"))).toBeNull();
  });
});
