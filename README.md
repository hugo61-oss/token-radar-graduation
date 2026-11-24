# Graduation Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hugo61-oss/token-radar-graduation/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hugo61-oss/token-radar-graduation/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar for make.fun's `token-radar-01` bounty: pre-token
protocols ranked by **expected launch value** — the probability a protocol
graduates (issues a token) times the value its token would carry.

## The angle: graduation prediction

A protocol "graduates" when it issues a token. The board answers two
questions per protocol, both from the sealed snapshot's own figures:

```text
expected_value = graduation_probability x peer_implied_fdv
peer_implied_fdv = tvl_usd x peer_multiple
```

- **Peer multiple**: the median market-cap-per-TVL of tokenized protocols in
  the same category, shrunk toward the global median (0.21x) when the
  category has few tokenized peers. Each peer's multiple is capped at 5x
  first, so a tiny-TVL protocol's 400x ratio cannot carry a whole category.
  It is what the market already pays per dollar of TVL for protocols like
  this one.
- **Graduation probability**: `logistic(z)` over five signals — log TVL
  (a launch needs scale), 7-day TVL growth, days listed with no token
  recorded, number of chains, and the category's own tokenization rate in
  this snapshot (shrunk toward the global rate of 55%).
- **Months to token**: `3 + 33 x (1 - p)`, a plain read-out of the
  probability, not a separate forecast.

No protocol name is special-cased: one function scores every row. The board
covers all 40 watchlist protocols plus every other rankable pre-token
protocol (198 rows). Protocols that structurally never launch their own
token — exchanges, bridges, staking wrappers, versioned pools — are
screened out of the ranking, except that every watchlist protocol is always
ranked. A protocol is called pre-token when its record carries no token:
no market cap, no CoinGecko id, no symbol. That is what the record says,
never proof it has no token.

The dashboard adds a graduation timeline (bands: within a year, one to two
years, two years out, long shot), a five-signal breakdown per protocol, a
farm plan with costs and times for each row, and a comparables table of the
tokenized protocols whose multiples the model uses.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes
`board.json` and `data.js` to the output directory, copies `dashboard/` and
`screenshots/` there, and writes `dossier.json` with the vendored make.fun
library. Two runs write the same bytes. Open `out/dashboard/index.html` in
a browser; `#detail=<slug>` opens a protocol, `#band=<band>` prefilters
the board.
