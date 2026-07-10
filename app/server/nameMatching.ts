// Fuzzy name-matching helpers for suggesting member-profile links during
// registration approval. Pure functions so they can be unit tested directly.

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Common nickname groups. Two first names are considered nickname-equivalent
// when they appear in the same group.
const NICKNAME_GROUPS: string[][] = [
  ["robert", "rob", "bob", "bobby"],
  ["william", "will", "bill", "billy", "liam"],
  ["elizabeth", "liz", "beth", "betsy", "eliza", "lizzie", "libby"],
  ["margaret", "meg", "maggie", "peggy", "peg", "marge"],
  ["james", "jim", "jimmy", "jamie"],
  ["john", "jack", "johnny", "jon"],
  ["jonathan", "jon", "jonny"],
  ["michael", "mike", "mikey"],
  ["richard", "rick", "ricky", "rich", "dick"],
  ["katherine", "catherine", "kathryn", "kate", "katie", "kathy", "cathy", "kat", "kitty"],
  ["jennifer", "jen", "jenny"],
  ["joseph", "joe", "joey"],
  ["thomas", "tom", "tommy"],
  ["charles", "charlie", "chuck", "chas"],
  ["christopher", "chris", "kit"],
  ["christine", "christina", "chris", "chrissy", "tina"],
  ["daniel", "dan", "danny"],
  ["matthew", "matt"],
  ["anthony", "tony"],
  ["steven", "stephen", "steve"],
  ["edward", "ed", "eddie", "ted", "ned"],
  ["andrew", "andy", "drew"],
  ["david", "dave", "davey"],
  ["patricia", "pat", "patty", "tricia", "trish"],
  ["patrick", "pat", "paddy"],
  ["susan", "sue", "susie", "suzanne"],
  ["deborah", "debbie", "deb", "debra"],
  ["barbara", "barb", "barbie"],
  ["nicholas", "nick", "nicky"],
  ["samuel", "sam", "sammy"],
  ["samantha", "sam", "sammy"],
  ["benjamin", "ben", "benny", "benji"],
  ["alexander", "alex", "al"],
  ["alexandra", "alex", "lexi", "sandra"],
  ["timothy", "tim", "timmy"],
  ["gregory", "greg"],
  ["kenneth", "ken", "kenny"],
  ["ronald", "ron", "ronnie"],
  ["donald", "don", "donnie"],
  ["raymond", "ray"],
  ["lawrence", "larry"],
  ["gerald", "jerry", "gerry"],
  ["jerome", "jerry"],
  ["walter", "walt", "wally"],
  ["henry", "hank", "harry", "hal"],
  ["harold", "harry", "hal"],
  ["dorothy", "dot", "dottie"],
  ["frances", "fran", "frannie", "francie"],
  ["francis", "frank", "fran"],
  ["franklin", "frank", "frankie"],
  ["virginia", "ginny"],
  ["martha", "marty"],
  ["rebecca", "becky", "becca"],
  ["abigail", "abby", "gail"],
  ["victoria", "vicky", "vicki", "tori"],
  ["cynthia", "cindy"],
  ["sandra", "sandy"],
  ["theodore", "ted", "teddy", "theo"],
  ["joshua", "josh"],
  ["zachary", "zach", "zack"],
  ["jacob", "jake"],
  ["nathaniel", "nathan", "nate", "nat"],
  ["cassandra", "cassie", "sandra"],
  ["jessica", "jess", "jessie"],
  ["stephanie", "steph"],
  ["melissa", "mel", "missy"],
  ["kimberly", "kim"],
  ["pamela", "pam"],
  ["angela", "angie"],
  ["amanda", "mandy"],
  ["emily", "em", "emmy"],
  ["albert", "al", "bert", "bertie"],
  ["arthur", "art", "artie"],
  ["eugene", "gene"],
  ["russell", "russ", "rusty"],
  ["leonard", "leo", "lenny", "len"],
  ["norman", "norm"],
  ["stanley", "stan"],
  ["philip", "phillip", "phil"],
  ["vincent", "vince", "vinny"],
  ["peter", "pete"],
  ["douglas", "doug"],
  ["dennis", "denny"],
  ["jeffrey", "jeff"],
  ["bradley", "brad"],
  ["bernard", "bernie"],
  ["eleanor", "ellie", "nora", "ella"],
  ["florence", "flo", "florrie"],
  ["gertrude", "trudy", "gertie"],
  ["mildred", "millie"],
  ["beverly", "bev"],
  ["constance", "connie"],
  ["gwendolyn", "gwen"],
  ["jacqueline", "jackie"],
  ["josephine", "jo", "josie"],
  ["judith", "judy"],
  ["kathleen", "kathy", "kate"],
  ["laura", "laurie"],
  ["lillian", "lily", "lil"],
  ["lucille", "lucy"],
  ["madeline", "maddie"],
  ["natalie", "nat"],
  ["penelope", "penny"],
  ["priscilla", "cilla"],
  ["rachel", "rae"],
  ["rosemary", "rose", "rosie"],
  ["shirley", "shirl"],
  ["sylvia", "syl"],
  ["teresa", "theresa", "terry", "tess"],
  ["valerie", "val"],
  ["veronica", "ronnie", "roni"],
  ["vivian", "viv"],
  ["wanda", "wendy"],
  ["yvonne", "vonnie"],
];

const NICKNAME_INDEX = new Map<string, Set<number>>();
NICKNAME_GROUPS.forEach((group, i) => {
  for (const name of group) {
    let set = NICKNAME_INDEX.get(name);
    if (!set) {
      set = new Set<number>();
      NICKNAME_INDEX.set(name, set);
    }
    set.add(i);
  }
});

export function areNicknames(a: string, b: string): boolean {
  const ga = NICKNAME_INDEX.get(a);
  const gb = NICKNAME_INDEX.get(b);
  if (!ga || !gb) return false;
  for (const g of ga) if (gb.has(g)) return true;
  return false;
}

// Damerau-Levenshtein (optimal string alignment) edit distance with an
// early-exit cap. Counts adjacent transpositions ("jhon" -> "john") as a
// single edit, since they are among the most common typing mistakes.
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prevPrev = new Array<number>(n + 1);
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prevPrev[j - 2] + 1);
      }
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prevPrev, prev, curr] = [prev, curr, prevPrev];
  }
  return prev[n];
}

function typoTolerance(len: number): number {
  if (len >= 6) return 2;
  if (len >= 4) return 1;
  return 0;
}

// Whether two last names are the same or within a small typo distance.
export function lastNamesMatch(a: string, b: string): { match: boolean; exact: boolean } {
  if (!a || !b) return { match: false, exact: false };
  if (a === b) return { match: true, exact: true };
  const tol = Math.min(typoTolerance(a.length), typoTolerance(b.length));
  if (tol > 0 && editDistance(a, b, tol) <= tol) return { match: true, exact: false };
  return { match: false, exact: false };
}

// How two first names relate: exact, nickname alias, typo-close, or none.
export function firstNameRelation(a: string, b: string): "exact" | "nickname" | "typo" | "none" {
  if (!a || !b) return "none";
  if (a === b) return "exact";
  if (areNicknames(a, b)) return "nickname";
  const tol = Math.min(typoTolerance(a.length), typoTolerance(b.length));
  if (tol > 0 && editDistance(a, b, tol) <= tol) return "typo";
  return "none";
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

// Free/shared email providers where a shared domain says nothing about a
// shared household.
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "comcast.net",
  "att.net",
  "verizon.net",
  "sbcglobal.net",
  "bellsouth.net",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "ymail.com",
  "me.com",
]);

export function isGenericEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain);
}

export interface CandidateMember {
  firstName: string;
  lastName: string;
  email: string | null;
}

export interface RegistrationInfo {
  fullName: string;
  email: string | null;
}

export interface MatchResult {
  matchType: "exact" | "close";
  matchedOn: string;
  score: number; // higher = stronger; used to rank close matches
}

// ---------- Prepared (precomputed) matching ----------
// Scoring a registration against every unlinked member is O(pending × members)
// with edit-distance computations in the inner loop. To keep the admin
// approvals page fast with thousands of profiles, we precompute normalized
// strings + character-count signatures once per registration/member, and use
// a cheap signature lower bound to skip edit-distance work for the vast
// majority of pairs. Results are identical to the naive pairwise scoring.

// Character-count signature over a-z plus total length. Any single edit
// (insert/delete/substitute/transpose) changes each of the surplus/deficit
// totals by at most 1, so max(surplus, deficit, |len diff|) is a valid lower
// bound on edit distance.
interface NameSig {
  len: number;
  counts: Int32Array;
}

function makeSig(s: string): NameSig {
  const counts = new Int32Array(26);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 97;
    if (c >= 0 && c < 26) counts[c]++;
  }
  return { len: s.length, counts };
}

function sigLowerBound(a: NameSig, b: NameSig): number {
  let surplus = 0;
  let deficit = 0;
  for (let i = 0; i < 26; i++) {
    const d = a.counts[i] - b.counts[i];
    if (d > 0) surplus += d;
    else deficit -= d;
  }
  const lenDiff = a.len > b.len ? a.len - b.len : b.len - a.len;
  const m = surplus > deficit ? surplus : deficit;
  return m > lenDiff ? m : lenDiff;
}

export interface PreparedRegistration {
  email: string;
  name: string;
  first: string;
  last: string; // "" when the name has fewer than two parts
  nameSig: NameSig;
  lastSig: NameSig;
  domain: string;
}

export interface PreparedCandidate<T extends CandidateMember = CandidateMember> {
  member: T;
  email: string;
  fullName: string;
  first: string;
  last: string;
  fullSig: NameSig;
  lastSig: NameSig;
  domain: string;
}

export function prepareRegistration(registration: RegistrationInfo): PreparedRegistration {
  const email = normalizeName(registration.email);
  const name = normalizeName(registration.fullName);
  const parts = name.split(" ");
  const last = parts.length >= 2 ? parts[parts.length - 1] : "";
  return {
    email,
    name,
    first: parts[0] ?? "",
    last,
    nameSig: makeSig(name),
    lastSig: makeSig(last),
    domain: email ? emailDomain(email) : "",
  };
}

export function prepareCandidate<T extends CandidateMember>(member: T): PreparedCandidate<T> {
  const email = normalizeName(member.email);
  const first = normalizeName(member.firstName);
  const last = normalizeName(member.lastName);
  const fullName = normalizeName(`${member.firstName} ${member.lastName}`);
  return {
    member,
    email,
    fullName,
    first,
    last,
    fullSig: makeSig(fullName),
    lastSig: makeSig(last),
    domain: email ? emailDomain(email) : "",
  };
}

// Same result as scoreMatch, but works on precomputed inputs so the hot loop
// avoids repeated normalization and skips edit distance via the signature
// lower bound.
export function scoreMatchPrepared(reg: PreparedRegistration, cand: PreparedCandidate): MatchResult | null {
  const emailExact = !!reg.email && !!cand.email && reg.email === cand.email;
  const nameExact = !!reg.name && reg.name === cand.fullName;

  if (emailExact || nameExact) {
    return {
      matchType: "exact",
      matchedOn: emailExact && nameExact ? "email and name" : emailExact ? "email" : "name",
      score: emailExact && nameExact ? 100 : 90,
    };
  }

  if (!reg.name || !reg.last) return null;

  const regLast = reg.last;
  const memLast = cand.last;
  let last: { match: boolean; exact: boolean };
  if (!regLast || !memLast) {
    last = { match: false, exact: false };
  } else if (regLast === memLast) {
    last = { match: true, exact: true };
  } else {
    const tol = Math.min(typoTolerance(regLast.length), typoTolerance(memLast.length));
    last =
      tol > 0 && sigLowerBound(reg.lastSig, cand.lastSig) <= tol && editDistance(regLast, memLast, tol) <= tol
        ? { match: true, exact: false }
        : { match: false, exact: false };
  }

  if (last.match) {
    const first = firstNameRelation(reg.first, cand.first);
    if (first === "nickname") {
      return { matchType: "close", matchedOn: "nickname", score: last.exact ? 80 : 70 };
    }
    if (first === "typo" || (first === "exact" && !last.exact)) {
      return { matchType: "close", matchedOn: "similar name", score: last.exact ? 75 : 65 };
    }
    if (first === "none" && last.exact && reg.email && cand.email) {
      if (reg.domain && reg.domain === cand.domain && !isGenericEmailDomain(reg.domain)) {
        return { matchType: "close", matchedOn: "last name and email domain", score: 55 };
      }
    }
    return null;
  }

  // No last-name match: catch a small typo across the whole name.
  const tol = Math.min(typoTolerance(reg.name.length), typoTolerance(cand.fullName.length));
  if (
    cand.fullName &&
    tol > 0 &&
    sigLowerBound(reg.nameSig, cand.fullSig) <= tol &&
    editDistance(reg.name, cand.fullName, tol) <= tol
  ) {
    return { matchType: "close", matchedOn: "similar name", score: 60 };
  }

  return null;
}

// Score how well a pending registration matches an unlinked member profile.
// Returns null when there is no meaningful similarity. Thin wrapper over the
// prepared path so one-off calls and bulk scoring share identical logic.
export function scoreMatch(registration: RegistrationInfo, member: CandidateMember): MatchResult | null {
  return scoreMatchPrepared(prepareRegistration(registration), prepareCandidate(member));
}
