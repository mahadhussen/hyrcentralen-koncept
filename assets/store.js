/* Hyrcentralen prototyp — delad datamotor.
   En sanningskälla för priser och bokningar. Ingen siffra hittas på:
   allt räknas ur HC_DATA som speglar hyrcentralen.com/priser. */
(function (w) {
  'use strict';
  var KEY = 'hc_bookings_v1';
  var D = w.HC_DATA || {};

  function kr(n) { return Math.round(n).toLocaleString('sv-SE'); }
  function dec(x) { return Number(x).toFixed(2).replace('.', ','); }
  /* Lokalt datum, aldrig toISOString: den räknar i UTC och tappar ett dygn
     för svensk tid (sommartid UTC+2). Ett tappat dygn är fel pris. */
  function iso(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parse(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }

  /* antal dygn mellan två datum, minst 1 */
  function days(from, to) {
    if (!from || !to) return 0;
    var ms = parse(to) - parse(from);
    var n = Math.round(ms / 86400000);
    return n > 0 ? n : (n === 0 ? 1 : 0);
  }

  /* Deterministisk prisberäkning. Returnerar rader + total. */
  function quote(o) {
    var c = D[o.group];
    var res = { rows: [], total: 0, days: 0, valid: false, error: null };
    if (!c) { res.error = 'Okänd bilklass'; return res; }
    var n = days(o.from, o.to);
    if (!n) { res.error = 'Välj datum'; return res; }
    res.days = n;

    var isWeekend = false;
    if (n === 3 && o.from) {
      var wd = parse(o.from).getDay(); /* 5 = fredag */
      isWeekend = (wd === 5);
    }

    if (o.fri) {
      var base = c.dfri * n;
      res.rows.push({ t: 'Fria km, ' + n + ' dygn × ' + kr(c.dfri) + ' kr', v: base });
      res.total += base;
    } else if (isWeekend && c.weekend < c.d100 * n) {
      res.rows.push({ t: 'Helgpaket, fre–mån', v: c.weekend, hint: true });
      res.total += c.weekend;
    } else {
      var b = c.d100 * n;
      res.rows.push({ t: n + ' dygn × ' + kr(c.d100) + ' kr (100 km/dygn ingår)', v: b });
      res.total += b;
      var incl = 100 * n;
      var over = Math.max(0, (+o.km || 0) - incl);
      if (over > 0) {
        var ex = over * c.exkm;
        res.rows.push({ t: 'Extra km, ' + over + ' × ' + dec(c.exkm) + ' kr', v: ex });
        res.total += ex;
      } else {
        res.rows.push({ t: 'Extra km, 0 av ' + incl + ' km ingår', v: 0 });
      }
    }
    if (o.self) {
      var s = c.selfRed * n;
      res.rows.push({ t: 'Självriskreducering, ' + n + ' × ' + kr(c.selfRed) + ' kr', v: s });
      res.total += s;
    }

    /* Ärligt tips: veckopris kan bli billigare */
    if (n >= 7) {
      var weeks = Math.ceil(n / 7);
      var wk = (o.fri ? c.vfri : c.v700) * weeks;
      if (wk < res.total) res.tip = 'Veckopris ' + kr(wk) + ' kr är billigare för ' + n + ' dygn. Vi ger dig det lägre priset.';
    }
    res.valid = true;
    return res;
  }

  /* Slutkostnad vid återlämning: faktisk sträcka kan skilja från beräknad */
  function settle(b) {
    var c = D[b.group];
    if (!c || b.km_in == null || b.km_out == null) return null;
    var driven = Math.max(0, b.km_in - b.km_out);
    var q = quote(b);
    if (b.fri) return { driven: driven, extra: 0, total: q.total, base: q.total };
    var incl = 100 * (q.days || 0);
    var over = Math.max(0, driven - incl);
    /* basen utan den uppskattade extra-km-raden */
    var base = q.rows.filter(function (r) { return r.t.indexOf('Extra km') !== 0; })
      .reduce(function (a, r) { return a + r.v; }, 0);
    var extra = over * c.exkm;
    return { driven: driven, incl: incl, over: over, extra: extra, base: base, total: base + extra, rate: c.exkm };
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function add(b) {
    var list = load();
    b.id = 'HC' + String(Date.now()).slice(-6);
    b.created = new Date().toISOString();
    b.status = 'ny';
    list.push(b);
    save(list);
    return b;
  }
  function update(id, patch) {
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { for (var k in patch) list[i][k] = patch[k]; }
    }
    save(list);
  }
  function remove(id) { save(load().filter(function (b) { return b.id !== id; })); }

  /* Tillgänglighet: hur många bokningar överlappar ett datum per grupp */
  function busyOn(dateStr, group) {
    return load().filter(function (b) {
      if (group && b.group !== group) return false;
      if (b.status === 'avbokad') return false;
      return b.from <= dateStr && dateStr < b.to;
    }).length;
  }

  /* Demodata så adminvyn aldrig står tom vid en visning */
  function seedIfEmpty() {
    if (load().length) return;
    var t = new Date(), today = iso(t);
    var demo = [
      { group: 'C', from: addDays(today, -1), to: addDays(today, 2), km: 400, fri: false, self: true,
        namn: 'Anna Lind', tel: '070 123 45 67', epost: 'anna@exempel.se', status: 'ute', km_out: 45120 },
      { group: 'F', from: today, to: addDays(today, 1), km: 90, fri: false, self: false,
        namn: 'Bygg & Co AB', tel: '031 45 67 89', epost: 'order@byggco.se', status: 'bekraftad' },
      { group: 'A', from: addDays(today, 2), to: addDays(today, 5), km: 700, fri: false, self: false,
        namn: 'Erik Sund', tel: '073 987 65 43', epost: 'erik@exempel.se', status: 'ny' },
      { group: 'E', from: addDays(today, -4), to: addDays(today, -1), km: 250, fri: false, self: true,
        namn: 'IK Ungdom', tel: '076 222 11 00', epost: 'kansli@ikungdom.se', status: 'klar',
        km_out: 88010, km_in: 88395 }
    ];
    demo.forEach(function (d) { add(d); });
  }

  w.HC = {
    kr: kr, dec: dec, iso: iso, days: days, addDays: addDays,
    quote: quote, settle: settle,
    load: load, add: add, update: update, remove: remove,
    busyOn: busyOn, seedIfEmpty: seedIfEmpty, data: D
  };
})(window);
