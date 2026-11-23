// Graduation Radar dashboard: board, filters, detail view, comparables.
// Reads window.GRAD_RADAR from ../data.js. No network: everything renders
// from that one object. Deep links: #detail=<slug> opens a protocol,
// #band=<soon|year|watch|longshot> prefilters the board.
(function () {
  var D = window.GRAD_RADAR;
  if (!D) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="11">No radar data found.</td></tr>';
    return;
  }

  var BAND_LABEL = { soon: 'Within a year', year: 'One to two years', watch: 'Two years out', longshot: 'Long shot' };
  var BAND_SHORT = { soon: 'Within a year', year: '1–2 years', watch: '2 yrs out', longshot: 'Long shot' };
  var rows = D.rows;
  var live = D.live;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n == null) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageText(days) {
    if (days == null) return 'n/a';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function bySlug(slug) {
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) return rows[i];
    return null;
  }

  // ---- header ----
  var soon = rows.filter(function (r) { return r.graduation_band === 'soon'; }).length;
  document.getElementById('meta').innerHTML =
    '<b>' + rows.length + '</b> protocols ranked &middot; <b>' + D.watchlist_size + '</b> watchlist<br>' +
    '<b>' + soon + '</b> within a year &middot; snapshot <b>' + esc(D.as_of) + '</b>';
  document.getElementById('asof').textContent = D.as_of;

  // ---- band buttons ----
  var bandsEl = document.getElementById('bands');
  ['soon', 'year', 'watch', 'longshot'].forEach(function (b) {
    var n = rows.filter(function (r) { return r.graduation_band === b; }).length;
    var btn = document.createElement('button');
    btn.className = 'band';
    btn.setAttribute('aria-pressed', 'false');
    btn.dataset.band = b;
    btn.innerHTML = '<span class="dot ' + b + '"></span>' + BAND_LABEL[b] + ' <span class="n">' + n + '</span>';
    btn.addEventListener('click', function () {
      var sel = document.getElementById('band');
      sel.value = sel.value === b ? '' : b;
      syncBandButtons();
      render();
    });
    bandsEl.appendChild(btn);
  });
  function syncBandButtons() {
    var v = document.getElementById('band').value;
    Array.prototype.forEach.call(bandsEl.children, function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.band === v));
    });
  }

  // ---- filter selects ----
  function fillSelect(id, values) {
    var el = document.getElementById(id);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    });
  }
  var cats = [];
  rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  fillSelect('cat', cats);
  var chains = [];
  rows.forEach(function (r) { r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
  chains.sort();
  fillSelect('chain', chains);

  // ---- state ----
  var state = { q: '', cat: '', band: '', chain: '', minp: 0, sort: 'value', detail: null };

  function readHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    parts.forEach(function (part) {
      var kv = part.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'detail' && bySlug(v)) state.detail = v;
      if (k === 'band' && BAND_LABEL[v]) state.band = v;
      if (k === 'cat' && cats.indexOf(v) >= 0) state.cat = v;
      if (k === 'chain' && chains.indexOf(v) >= 0) state.chain = v;
      if (k === 'minp' && ['0.3', '0.5', '0.7'].indexOf(v) >= 0) state.minp = parseFloat(v);
      if (k === 'sort') state.sort = v;
      if (k === 'q') state.q = v;
    });
    document.getElementById('band').value = state.band;
    document.getElementById('cat').value = state.cat;
    document.getElementById('chain').value = state.chain;
    document.getElementById('minp').value = String(state.minp);
    document.getElementById('sort').value = state.sort;
    document.getElementById('q').value = state.q;
    syncBandButtons();
  }

  function current() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.band && r.graduation_band !== state.band) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.graduation_probability < state.minp) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var sorts = {
      value: function (a, b) { return a.rank - b.rank; },
      prob: function (a, b) { return b.graduation_probability - a.graduation_probability || a.rank - b.rank; },
      fdv: function (a, b) { return b.implied_fdv_usd - a.implied_fdv_usd || a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; },
      growth: function (a, b) { return (b.change_7d == null ? -999 : b.change_7d) - (a.change_7d == null ? -999 : a.change_7d) || a.rank - b.rank; },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days) || a.rank - b.rank; },
      months: function (a, b) { return a.months_to_token - b.months_to_token || a.rank - b.rank; }
    };
    list.sort(sorts[state.sort] || sorts.value);
    return list;
  }

  // ---- board ----
  function render() {
    var list = current();
    var tbody = document.getElementById('rows');
    var html = list.map(function (r) {
      var g = r.change_7d == null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (state.detail === r.slug ? 'open' : '') + '">' +
        '<td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b><br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || 'n/a') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + g + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><span class="prob"><span class="bar"><i class="' + r.graduation_band + '" style="width:' + Math.round(r.graduation_probability * 100) + '%"></i></span>' + Math.round(r.graduation_probability * 100) + '%</span><br><span class="pill ' + r.graduation_band + '">' + BAND_SHORT[r.graduation_band] + '</span></td>' +
        '<td class="num">' + r.months_to_token + '</td>' +
        '<td class="num">' + money(r.implied_fdv_usd) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    }).join('');
    tbody.innerHTML = html;
    document.getElementById('empty').hidden = list.length > 0;
    document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' shown';
    renderDetail();
  }

  // ---- detail ----
  function signalRow(label, value, max) {
    var w = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
    return '<li><span>' + label + '</span><span class="bar"><i style="width:' + w + '%"></i></span><span>' + value.toFixed(2) + '</span></li>';
  }
  function renderDetail() {
    var el = document.getElementById('detail');
    var r = state.detail ? bySlug(state.detail) : null;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML =
      '<button class="close" id="closeDetail">Close</button>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="tag">Rank ' + r.rank + ' &middot; ' + esc(r.category || 'Uncategorized') + ' &middot; ' + esc(r.chains.join(', ')) +
      ' &middot; listed ' + esc(r.listed_at || 'date not recorded') + ' &middot; records no token</p>' +
      '<div class="grid">' +
      '<div class="stat"><div class="k">Graduation probability</div><div class="v">' + Math.round(r.graduation_probability * 100) + '% &middot; ' + BAND_LABEL[r.graduation_band] + '</div></div>' +
      '<div class="stat"><div class="k">Months to token (read-out)</div><div class="v">~' + r.months_to_token + ' months</div></div>' +
      '<div class="stat"><div class="k">Peer-implied token value</div><div class="v">' + money(r.implied_fdv_usd) + '</div></div>' +
      '<div class="stat"><div class="k">Expected value</div><div class="v">' + money(r.implied_value_usd) + '</div></div>' +
      '<div class="stat"><div class="k">TVL</div><div class="v">' + money(r.tvl_usd) + '</div></div>' +
      '<div class="stat"><div class="k">7-day TVL change</div><div class="v">' + pct(r.change_7d) + '</div></div>' +
      '<div class="stat"><div class="k">Age with no token</div><div class="v">' + ageText(r.age_days) + '</div></div>' +
      '<div class="stat"><div class="k">Peer multiple (' + r.peer_count + (r.peer_count === 1 ? ' peer' : ' peers') + ')</div><div class="v">' + r.peer_multiple.toFixed(2) + 'x</div></div>' +
      '</div>' +
      '<h3>Why this probability: the five signals</h3>' +
      '<ul class="signals">' +
      signalRow('Size (log TVL)', r.z_size, 1) +
      signalRow('Growth (7d, clamped)', r.z_growth, 0.6) +
      signalRow('Age with no token', r.z_age, 1) +
      signalRow('Reach (chains)', r.z_reach, 1) +
      signalRow('Category prior', r.z_prior, 0.45) +
      '</ul>' +
      '<p style="color:var(--muted);font-size:13px">Peer multiple ' + r.peer_multiple.toFixed(2) + 'x is the median market-cap-per-TVL of ' +
      r.peer_count + ' tokenized ' + esc(r.category || '') + ' protocol' + (r.peer_count === 1 ? '' : 's') + ' in this snapshot (global median ' + D.global_multiple.toFixed(2) +
      'x), each peer capped at 5x and shrunk toward the global median. Expected value = probability &times; peer-implied token value.</p>' +
      '<h3>Farm plan</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    document.getElementById('closeDetail').addEventListener('click', function () {
      state.detail = null;
      location.hash = '';
      render();
    });
  }

  // ---- comparables ----
  document.getElementById('live').innerHTML = live.map(function (p) {
    return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || 'n/a') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + p.multiple.toFixed(2) + 'x</td></tr>';
  }).join('');

  // ---- events ----
  document.getElementById('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.detail = state.detail === tr.dataset.slug ? null : tr.dataset.slug;
    location.hash = state.detail ? 'detail=' + state.detail : '';
    render();
    if (state.detail) document.getElementById('detail').scrollIntoView();
  });
  ['q', 'cat', 'band', 'chain', 'minp', 'sort'].forEach(function (id) {
    document.getElementById(id).addEventListener(id === 'q' ? 'input' : 'change', function (e) {
      state[id === 'minp' ? 'minp' : id] = id === 'minp' ? parseFloat(e.target.value) : e.target.value;
      if (id === 'band') syncBandButtons();
      render();
    });
  });
  document.querySelectorAll('.board thead th[data-k]').forEach(function (th) {
    th.addEventListener('click', function () {
      var map = { rank: 'value', name: 'value', category: 'value', tvl: 'tvl', growth: 'growth', age: 'age', prob: 'prob', months: 'months', fdv: 'fdv', value: 'value' };
      state.sort = map[th.dataset.k] || 'value';
      document.getElementById('sort').value = state.sort;
      render();
    });
  });

  readHash();
  render();
})();
