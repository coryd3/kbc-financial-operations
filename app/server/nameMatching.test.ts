import { describe, it, expect } from "vitest";
import {
  scoreMatch,
  areNicknames,
  editDistance,
  lastNamesMatch,
  firstNameRelation,
  isGenericEmailDomain,
  normalizeName,
  emailDomain,
  prepareRegistration,
  prepareCandidate,
  scoreMatchPrepared,
  type RegistrationInfo,
  type CandidateMember,
  type MatchResult,
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

// Naive reference implementation of the original pairwise scoring (before the
// prepared/signature-pre-filter optimization). The optimized path must return
// identical results.
function referenceScoreMatch(registration: RegistrationInfo, member: CandidateMember): MatchResult | null {
  const regEmail = normalizeName(registration.email);
  const regName = normalizeName(registration.fullName);
  const memEmail = normalizeName(member.email);
  const memName = normalizeName(`${member.firstName} ${member.lastName}`);

  const emailExact = !!regEmail && !!memEmail && regEmail === memEmail;
  const nameExact = !!regName && regName === memName;

  if (emailExact || nameExact) {
    return {
      matchType: "exact",
      matchedOn: emailExact && nameExact ? "email and name" : emailExact ? "email" : "name",
      score: emailExact && nameExact ? 100 : 90,
    };
  }

  if (!regName) return null;
  const regParts = regName.split(" ");
  if (regParts.length < 2) return null;
  const regFirst = regParts[0];
  const regLast = regParts[regParts.length - 1];
  const memFirst = normalizeName(member.firstName);
  const memLast = normalizeName(member.lastName);

  const last = lastNamesMatch(regLast, memLast);
  if (last.match) {
    const first = firstNameRelation(regFirst, memFirst);
    if (first === "nickname") {
      return { matchType: "close", matchedOn: "nickname", score: last.exact ? 80 : 70 };
    }
    if (first === "typo" || (first === "exact" && !last.exact)) {
      return { matchType: "close", matchedOn: "similar name", score: last.exact ? 75 : 65 };
    }
    if (first === "none" && last.exact && regEmail && memEmail) {
      const regDomain = emailDomain(regEmail);
      const memDomain = emailDomain(memEmail);
      if (regDomain && regDomain === memDomain && !isGenericEmailDomain(regDomain)) {
        return { matchType: "close", matchedOn: "last name and email domain", score: 55 };
      }
    }
    return null;
  }

  const tolerance = (len: number) => (len >= 6 ? 2 : len >= 4 ? 1 : 0);
  const tol = Math.min(tolerance(regName.length), tolerance(memName.length));
  if (memName && tol > 0 && editDistance(regName, memName, tol) <= tol) {
    return { matchType: "close", matchedOn: "similar name", score: 60 };
  }

  return null;
}

// Deterministic pseudo-random generator so failures are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRSTS = ["Robert", "Bob", "Elizabeth", "Liz", "John", "Jhon", "Margaret", "Peggy", "Carol", "Al", "Jo", "Sam"];
const LASTS = ["Smith", "Smyth", "Smithson", "Smythson", "Jones", "Jones", "Lee", "Li", "Washington", "Washingtn"];
const DOMAINS = ["gmail.com", "smithhome.net", "joneshouse.org", "yahoo.com"];

describe("scoreMatchPrepared equivalence with reference scoring", () => {
  it("matches the reference implementation across randomized name/email pairs", () => {
    const rand = mulberry32(42);
    const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const maybeEmail = (first: string) =>
      rand() < 0.3 ? null : `${first.toLowerCase()}@${pick(DOMAINS)}`;

    for (let i = 0; i < 2000; i++) {
      const regFirst = pick(FIRSTS);
      const regLast = pick(LASTS);
      const registration = {
        fullName: rand() < 0.05 ? regFirst : `${regFirst} ${regLast}`,
        email: maybeEmail(regFirst),
      };
      const memFirst = pick(FIRSTS);
      const member = {
        firstName: memFirst,
        lastName: pick(LASTS),
        email: maybeEmail(memFirst),
      };

      const expected = referenceScoreMatch(registration, member);
      const viaWrapper = scoreMatch(registration, member);
      const viaPrepared = scoreMatchPrepared(prepareRegistration(registration), prepareCandidate(member));
      const label = `${registration.fullName} <${registration.email}> vs ${member.firstName} ${member.lastName} <${member.email}>`;
      expect(viaWrapper, label).toEqual(expected);
      expect(viaPrepared, label).toEqual(expected);
    }
  });
});

describe("bulk scoring performance", () => {
  it("scores 40 pending users against 1,500 members well under a second", () => {
    const rand = mulberry32(7);
    const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const members = Array.from({ length: 1500 }, (_, i) => ({
      firstName: `${pick(FIRSTS)}${i % 7 === 0 ? "" : i}`,
      lastName: `${pick(LASTS)}${i % 5 === 0 ? "" : i}`,
      email: i % 3 === 0 ? null : `person${i}@${pick(DOMAINS)}`,
    }));
    const pending = Array.from({ length: 40 }, (_, i) => ({
      fullName: `${pick(FIRSTS)} ${pick(LASTS)}${i % 4 === 0 ? "" : i}`,
      email: i % 2 === 0 ? null : `pending${i}@${pick(DOMAINS)}`,
    }));

    const candidates = members.map((m) => prepareCandidate(m));
    const start = performance.now();
    let matches = 0;
    for (const p of pending) {
      const prepared = prepareRegistration(p);
      for (const c of candidates) {
        if (scoreMatchPrepared(prepared, c)) matches++;
      }
    }
    const elapsed = performance.now() - start;
    expect(matches).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(500);
  });
});
