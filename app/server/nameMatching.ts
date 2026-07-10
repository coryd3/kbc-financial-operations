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

// Score how well a pending registration matches an unlinked member profile.
// Returns null when there is no meaningful similarity.
export function scoreMatch(registration: RegistrationInfo, member: CandidateMember): MatchResult | null {
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

  // No last-name match: catch a small typo across the whole name.
  const tol = Math.min(typoTolerance(regName.length), typoTolerance(memName.length));
  if (memName && tol > 0 && editDistance(regName, memName, tol) <= tol) {
    return { matchType: "close", matchedOn: "similar name", score: 60 };
  }

  return null;
}
