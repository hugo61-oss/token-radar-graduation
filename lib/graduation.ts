// Graduation Radar: which pre-token protocols are most likely to launch a token,
// and what that token would be worth.
//
// Angle: graduation prediction. A protocol "graduates" when it issues a token.
// The board ranks pre-token protocols by EXPECTED launch value:
//
//   expected_value = graduation_probability x peer_implied_fdv
//
// Both factors come only from the sealed snapshot's own figures:
//
//   peer_implied_fdv = tvl_usd x peer_multiple
//     peer_multiple = the median mcap/TVL of tokenized protocols in the same
//     category (shrunk toward the global median when the category has few
//     tokenized peers), i.e. what the market already pays per dollar of TVL
//     for protocols like this one. Each peer's multiple is capped at 5x
//     first: a token worth five times its TVL is already generous, and beyond
//     that the ratio says more about a tiny TVL denominator than about value
//     (the snapshot's own multiples run to 400x on that artifact).
//
//   graduation_probability = logistic(z), z a weighted sum of five signals:
//     size     - log10 TVL: a launch needs scale
//     growth   - 7-day TVL change: growing protocols capitalise the moment
//     age      - days listed with no token: the longer the record, the nearer
//     reach    - number of chains: multi-chain operations are launch-ready
//     prior    - the category's own tokenization rate in this snapshot
//              (shrunk toward the global rate), i.e. how often this kind of
//              protocol graduates at all.
//
// No protocol name is ever special-cased: one function scores every row.
// Months-to-token is a plain read-out of the probability:
//   months = round(3 + 33 * (1 - p))  ->  p = 0.9 reads ~6 months, p = 0.2 ~29.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  /** Prior count for shrinking a category's tokenization rate toward the global rate. */
  prior_strength: number;
  /** Prior count for shrinking a category's peer multiple toward the global median. */
  multiple_strength: number;
  /** Ceiling on one peer's mcap/TVL before the category median is taken. */
  multiple_cap: number;
  /** Size signal: log10 TVL mapped from [7, 10] onto [0, 1]. */
  size_lo: number;
  size_hi: number;
  /** Growth signal: change_7d clamped to this window, in per cent. */
  growth_floor: number;
  growth_cap: number;
  /** Age signal: age_days capped at this many days. */
  age_cap_days: number;
  /** Reach signal: chains beyond the first, capped at this many. */
  reach_cap: number;
  /** Logistic weights: intercept, size, growth, age, reach, category prior. */
  w_intercept: number;
  w_size: number;
  w_growth: number;
  w_age: number;
  w_reach: number;
  w_prior: number;
  /** Months-to-token read-out: months = months_base + months_span * (1 - p). */
  months_base: number;
  months_span: number;
  /** Age used when listed_at is missing. */
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  prior_strength: 6,
  multiple_strength: 4,
  multiple_cap: 5,
  size_lo: 7,
  size_hi: 10,
  growth_floor: -30,
  growth_cap: 60,
  age_cap_days: 1095,
  reach_cap: 5,
  w_intercept: -0.9,
  w_size: 1.1,
  w_growth: 1.2,
  w_age: 0.9,
  w_reach: 0.5,
  w_prior: 1.4,
  months_base: 3,
  months_span: 33,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'graduation-1';

/** Graduation bands, by probability. */
export type GradBand = 'soon' | 'year' | 'watch' | 'longshot';

export function bandOf(p: number): GradBand {
  if (p >= 0.7) return 'soon';
  if (p >= 0.5) return 'year';
  if (p >= 0.3) return 'watch';
  return 'longshot';
}

export const BAND_LABEL: Record<GradBand, string> = {
  soon: 'Within a year',
  year: 'One to two years',
  watch: 'Two years out',
  longshot: 'Long shot',
};

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  graduation_probability: number;
  graduation_band: GradBand;
  months_to_token: number;
  peer_multiple: number;
  peer_count: number;
  implied_fdv_usd: number;
  implied_value_usd: number;
  model: {
    size: number;
    growth: number;
    age: number;
    reach: number;
    category_prior: number;
    z: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  graduation_probability: number;
  graduation_band: GradBand;
  months_to_token: number;
  peer_multiple: number;
  peer_count: number;
  implied_fdv_usd: number;
  implied_value_usd: number;
  z_size: number;
  z_growth: number;
  z_age: number;
  z_reach: number;
  z_prior: number;
  farm_steps: string[];
}

/** A tokenized protocol, shown as a market comparable, never a board row. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  multiple: number;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  global_multiple: number;
  global_prior: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED = /\b(wrapped|staked|staking)\b/i;
/** Categories that structurally never launch their own token. */
const NO_LAUNCH = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol is a plausible graduation candidate: pre-token, not an exchange, bridge or
 *  staking wrapper, and not a versioned pool of another protocol. The watchlist rule already
 *  screens the same way, so every watchlist row passes this. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== null && !NO_LAUNCH.has(p.category) && !VERSIONED.test(p.name) && !WRAPPED.test(p.name);
}

/** Parse and validate the snapshot document. */
export function parseSnapshot(text: string): Snapshot {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot is not JSON');
  }
  if (typeof doc !== 'object' || doc === null) throw new SnapshotError('snapshot is not an object');
  const d = doc as Record<string, unknown>;
  if (typeof d.as_of !== 'string' || typeof d.floor_usd !== 'number' || !Array.isArray(d.protocols) || !Array.isArray(d.watchlist)) {
    throw new SnapshotError('snapshot is missing as_of, floor_usd, protocols or watchlist');
  }
  return doc as Snapshot;
}

/** Peer statistics derived from the snapshot's tokenized protocols. */
export interface PeerStats {
  /** Median mcap/TVL across tokenized protocols with a market cap. */
  globalMultiple: number;
  /** Share of protocols that record a token. */
  globalPrior: number;
  /** Per-category: [tokenized count, total count, median multiple, peers with mcap]. */
  byCategory: Map<string, { total: number; tokenized: number; multiple: number; peers: number }>;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function peerStats(snapshot: Snapshot, model: ModelConstants = MODEL): PeerStats {
  const byCategory = new Map<string, { total: number; tokenized: number; multiples: number[] }>();
  const allMultiples: number[] = [];
  let tokenized = 0;
  for (const p of snapshot.protocols) {
    let c = byCategory.get(p.category ?? 'Uncategorized');
    if (c === undefined) {
      c = { total: 0, tokenized: 0, multiples: [] };
      byCategory.set(p.category ?? 'Uncategorized', c);
    }
    c.total += 1;
    if (!isPreToken(p)) {
      tokenized += 1;
      c.tokenized += 1;
      if (p.mcap_usd !== null && p.tvl_usd > 0) {
        // Cap one peer's multiple before the median: a tiny TVL denominator
        // can print a 400x ratio that says nothing about token value.
        const m = Math.min(p.mcap_usd / p.tvl_usd, model.multiple_cap);
        c.multiples.push(m);
        allMultiples.push(m);
      }
    }
  }
  const out = new Map<string, { total: number; tokenized: number; multiple: number; peers: number }>();
  for (const [cat, c] of byCategory) {
    out.set(cat, { total: c.total, tokenized: c.tokenized, multiple: median(c.multiples), peers: c.multiples.length });
  }
  return {
    globalMultiple: median(allMultiples),
    globalPrior: snapshot.protocols.length > 0 ? tokenized / snapshot.protocols.length : 0.5,
    byCategory: out,
  };
}

/** A category's tokenization rate, shrunk toward the global rate. */
export function categoryPrior(category: string | null, stats: PeerStats, model: ModelConstants): number {
  const c = stats.byCategory.get(category ?? 'Uncategorized');
  if (c === undefined) return stats.globalPrior;
  const k = model.prior_strength;
  return (c.tokenized + k * stats.globalPrior) / (c.total + k);
}

/** A category's peer multiple, shrunk toward the global median. */
export function peerMultiple(category: string | null, stats: PeerStats, model: ModelConstants): { multiple: number; peers: number } {
  const c = stats.byCategory.get(category ?? 'Uncategorized');
  if (c === undefined || c.peers === 0) return { multiple: stats.globalMultiple, peers: 0 };
  const k = model.multiple_strength;
  return { multiple: (c.peers * c.multiple + k * stats.globalMultiple) / (c.peers + k), peers: c.peers };
}

/** The five signals, the logistic score and the graduation probability. */
export function graduation(
  p: SnapshotProtocol,
  asOf: string,
  stats: PeerStats,
  model: ModelConstants,
): { probability: number; z: number; signals: { size: number; growth: number; age: number; reach: number; prior: number } } {
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const size = clamp((Math.log10(Math.max(p.tvl_usd, 1)) - model.size_lo) / (model.size_hi - model.size_lo), 0, 1);
  const growth = clamp(finite(p.change_7d, 0), model.growth_floor, model.growth_cap) / 100;
  const ageSignal = clamp(ageForModel, 0, model.age_cap_days) / model.age_cap_days;
  const reach = clamp(p.chains.length - 1, 0, model.reach_cap) / model.reach_cap;
  const prior = categoryPrior(p.category, stats, model);
  const priorSignal = prior - stats.globalPrior;
  const z =
    model.w_intercept +
    model.w_size * size +
    model.w_growth * growth +
    model.w_age * ageSignal +
    model.w_reach * reach +
    model.w_prior * priorSignal;
  const probability = 1 / (1 + Math.exp(-z));
  return { probability, z, signals: { size, growth, age: ageSignal, reach, prior: priorSignal } };
}

/** The capital tier for one farm position, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  return 75;
}

/** How many days of weekly activity the plan asks for, from the graduation band and the age. */
function holdDaysFor(band: GradBand, age: number | null): number {
  const base = band === 'soon' ? 90 : band === 'year' ? 60 : band === 'watch' ? 45 : 30;
  if (age !== null && age < 180) return base + 30;
  return base;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function chainList(p: SnapshotProtocol): string {
  if (p.chains.length === 0) return 'its main chain';
  if (p.chains.length === 1) return p.chains[0]!;
  return `${p.chains.slice(0, 3).join(', ')}${p.chains.length > 3 ? ` and ${p.chains.length - 3} more` : ''}`;
}

/** The category's one core action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC as collateral on ${name} on ${chain} and borrow a small amount against it.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position in range.`;
  if (c.includes('yield aggregator')) return `Deposit $${capital} into ${name}'s highest-TVL vault on ${chain} and hold the vault shares.`;
  if (c.includes('yield') || c.includes('leveraged farm')) return `Deposit $${capital} into a ${name} yield vault on ${chain} and leave the position compounding.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC through ${name} to ${chain} and use the bridged funds inside its app.`;
  if (c.includes('restak') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('option')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund your account with $${capital} on ${name} and take one position in an active market.`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} curator vault on ${chain} and keep the vault shares.`;
  if (c.includes('stablecoin') || c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('farm')) return `Deposit $${capital} into ${name}'s main farm on ${chain} and keep the position staked.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and use its main feature once a week.`;
}

/** One farm step: action, cost and time in a single string the gate accepts. */
function stepText(text: string, cost: string, time: string): string {
  let s = `${text} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and re-check the protocol's own page each week.`;
  return s;
}

/** Six concrete farm steps for one protocol, tuned to its category, band and age. */
export function farmSteps(p: SnapshotProtocol, age: number | null, probability: number, band: GradBand): string[] {
  const capital = capitalFor(p);
  const chain = chainOf(p);
  const hold = holdDaysFor(band, age);
  const weeks = Math.max(4, Math.round(hold / 7));
  const urgency =
    band === 'soon'
      ? `The radar puts graduation within about ${Math.round(MODEL.months_base + MODEL.months_span * (1 - probability))} months, so start this week and front-load the activity below.`
      : band === 'year'
        ? `The radar puts graduation within about a year, so build the history steadily over the next ${weeks} weeks rather than rushing it in one day.`
        : band === 'watch'
          ? `The radar puts graduation one to two years out, so pace the activity below across ${weeks} weeks and revisit the position monthly.`
          : `The radar rates graduation a long shot, so treat this as a cheap lottery ticket: one small position, checked monthly, not a weekly grind.`;
  const gas = p.chains.length > 1 ? 'about $2 to $8 of gas per transaction on its main chain, plus a bridge fee if you move funds across chains' : 'about $2 to $8 of gas per transaction on its main chain';
  return [
    stepText(actionFor(p, capital, chain), `$${capital} of capital plus ${gas}`, `15 minutes to set up, then hold for at least ${hold} days`),
    stepText(
      `Return to ${p.name} once a week for ${weeks} weeks and repeat the core action above, using the same wallet address every time so the activity builds one visible history.`,
      'no extra capital, only gas of about $2 to $8 per visit',
      `${weeks} weeks, about 10 minutes per visit`,
    ),
    stepText(
      `Use the protocol's own app on ${chainList(p)} rather than a third-party front end, and if it runs a points or quests program, complete the weekly tasks it lists with the same address.`,
      'free apart from gas',
      '10 minutes per week',
    ),
    stepText(urgency, `the $${capital} position plus gas`, `${hold} days of activity`),
    stepText(
      `Keep a record of every deposit, transaction hash and date for ${p.name} in a notebook, and set a calendar reminder to check for a token or points announcement once a week.`,
      'free',
      '5 minutes per week',
    ),
    stepText(
      `Do not chase the position with more capital if the protocol's TVL falls two weeks in a row; unwind by withdrawing the $${capital} stake and leaving only a dust position, and never pay anyone who promises to boost your allocation.`,
      'one withdrawal transaction, about $2 to $8 of gas',
      '15 minutes to unwind',
    ),
  ];
}

/** Score one protocol into a board row. */
function scoreRow(p: SnapshotProtocol, asOf: string, stats: PeerStats, model: ModelConstants): BoardRow {
  const age = ageDays(asOf, p.listed_at);
  const { probability, z, signals } = graduation(p, asOf, stats, model);
  const { multiple, peers } = peerMultiple(p.category, stats, model);
  const impliedFdv = Math.max(1, Math.round(p.tvl_usd * multiple));
  const expected = Math.max(1, Math.round(probability * impliedFdv));
  const band = bandOf(probability);
  const months = Math.round(model.months_base + model.months_span * (1 - probability));
  return {
    rank: 0,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: [...p.chains],
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    age_days: age,
    graduation_probability: round4(probability),
    graduation_band: band,
    months_to_token: months,
    peer_multiple: round4(multiple),
    peer_count: peers,
    implied_fdv_usd: impliedFdv,
    implied_value_usd: expected,
    model: {
      size: round4(signals.size),
      growth: round4(signals.growth),
      age: round4(signals.age),
      reach: round4(signals.reach),
      category_prior: round4(categoryPrior(p.category, stats, model)),
      z: round4(z),
    },
    farm_steps: farmSteps(p, age, probability, band),
  };
}

/** The ranked board: every watchlist row plus every other rankable pre-token protocol. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const stats = peerStats(snapshot);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => scoreRow(p, snapshot.as_of, stats, model));
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });
  return scored;
}

/** The live-token comparables: the largest tokenized protocols by market cap. */
export function buildLive(snapshot: Snapshot, count = 24): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.tvl_usd > 0)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd as number,
      change_7d: p.change_7d,
      multiple: round4((p.mcap_usd as number) / p.tvl_usd),
    }))
    .sort((a, b) => b.mcap_usd - a.mcap_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, count);
}

/** Everything the dashboard needs, from the board and the snapshot. */
export function buildRadar(snapshot: Snapshot, board: BoardRow[]): RadarData {
  const stats = peerStats(snapshot);
  const rows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: r.listed_at,
    age_days: r.age_days,
    graduation_probability: r.graduation_probability,
    graduation_band: r.graduation_band,
    months_to_token: r.months_to_token,
    peer_multiple: r.peer_multiple,
    peer_count: r.peer_count,
    implied_fdv_usd: r.implied_fdv_usd,
    implied_value_usd: r.implied_value_usd,
    z_size: r.model.size,
    z_growth: r.model.growth,
    z_age: r.model.age,
    z_reach: r.model.reach,
    z_prior: r.model.category_prior,
    farm_steps: r.farm_steps,
  }));
  return {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model: MODEL,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: 24,
    global_multiple: round4(stats.globalMultiple),
    global_prior: round4(stats.globalPrior),
    rows,
    live: buildLive(snapshot, 24),
  };
}

/** The dashboard's data file: one script that sets window.GRAD_RADAR. */
export function dataScript(radar: RadarData): string {
  return `window.GRAD_RADAR = ${JSON.stringify(radar)};\n`;
}

/** The gate's own shape, checked before anything is written: null when the board passes. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, the gate wants 100 to 4000`;
  const slugs = new Set<string>();
  let prev = Number.POSITIVE_INFINITY;
  let allSame = board.length > 1;
  const first = board.length > 0 ? board[0]!.implied_value_usd : 0;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `row ${r.slug} carries rank ${r.rank}, expected ${i + 1}`;
    if (!known.has(r.slug)) return `row ${r.slug} is not a protocol in the snapshot`;
    if (slugs.has(r.slug)) return `row ${r.slug} appears twice`;
    slugs.add(r.slug);
    if (typeof r.name !== 'string' || r.name.length === 0) return `row ${r.slug} has no name`;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `row ${r.slug} has an implied value of ${r.implied_value_usd}`;
    }
    if (r.implied_value_usd > prev) return `row ${r.slug} rises above the row before it`;
    prev = r.implied_value_usd;
    if (r.implied_value_usd !== first) allSame = false;
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `row ${r.slug} holds ${Array.isArray(r.farm_steps) ? r.farm_steps.length : 'no'} farm steps`;
    }
    for (const s of r.farm_steps) {
      const t = typeof s === 'string' ? s.trim() : '';
      if (t.length < 20 || t.length > 600) return `row ${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  if (allSame) return 'every row carries the same implied value';
  for (const slug of snapshot.watchlist) {
    if (!slugs.has(slug)) return `watchlist protocol ${slug} is missing from the board`;
  }
  return null;
}
