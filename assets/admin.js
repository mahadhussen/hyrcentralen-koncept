/* Adminvy: översikt, bokningar, tillgänglighet och utlämningsprotokoll. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = window.HC_DATA, H = window.HC;
  var PIN = '1234';
  var tab = 'idag';

  H.seedIfEmpty();

  /* ---------- inloggning ---------- */
  function tryPin() {
    if ($('pin').value === PIN) { sessionStorage.setItem('hc_admin', '1'); boot(); }
    else { $('pinerr').hidden = false; $('pin').value = ''; }
  }
  if ($('pinBtn')) {
    $('pinBtn').addEventListener('click', tryPin);
    $('pin').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPin(); });
  }
  if (sessionStorage.getItem('hc_admin') === '1') boot();

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var STATUS = { ny: 'Ny', bekraftad: 'Bekräftad', ute: 'Ute', klar: 'Klar', avbokad: 'Avbokad' };

  function boot() {
    document.body.classList.add('logged');
    render();
  }

  function shell(inner) {
    var today = H.iso(new Date());
    var all = H.load();
    var out = all.filter(function (b) { return b.from === today && b.status !== 'avbokad' && b.status !== 'klar'; });
    var back = all.filter(function (b) { return b.to === today && b.status === 'ute'; });
    return '' +
      '<header class="ahead"><div class="awrap">' +
        '<a href="index.html"><img class="logo" src="assets/logo.png" alt="Hyrcentralen"></a>' +
        '<div class="atabs">' +
          ['idag,Översikt', 'bok,Bokningar', 'kal,Tillgänglighet'].map(function (t) {
            var p = t.split(',');
            return '<button class="atab' + (tab === p[0] ? ' on' : '') + '" data-tab="' + p[0] + '">' + p[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="abadge">' + out.length + ' ut · ' + back.length + ' in idag</div>' +
      '</div></header>' +
      '<main class="awrap amain">' + inner + '</main>';
  }

  function kpis() {
    var all = H.load().filter(function (b) { return b.status !== 'avbokad'; });
    var today = H.iso(new Date());
    var ute = all.filter(function (b) { return b.status === 'ute'; });
    var intakt = all.filter(function (b) { return b.status === 'klar' || b.status === 'ute'; })
      .reduce(function (a, b) { var s = H.settle(b); return a + (s ? s.total : (b.pris || 0)); }, 0);
    var fleet = Object.keys(D).length;
    var bel = Math.round(ute.length / fleet * 100);
    var nya = all.filter(function (b) { return b.status === 'ny'; }).length;
    var K = [
      ['Ute nu', ute.length + ' / ' + fleet, 'bilar på vägen'],
      ['Beläggning', bel + ' %', 'av flottan'],
      ['Väntar svar', nya, 'obekräftade'],
      ['Intäkt', H.kr(intakt) + ' kr', 'pågående + klara']
    ];
    return '<div class="kpis">' + K.map(function (k) {
      return '<div class="kpi"><span class="kl">' + k[0] + '</span><span class="kv">' + k[1] + '</span><span class="ks">' + k[2] + '</span></div>';
    }).join('') + '</div>';
  }

  function row(b) {
    var c = D[b.group] || {};
    var s = H.settle(b);
    var pris = s ? s.total : (b.pris || 0);
    return '<tr>' +
      '<td class="acar"><img src="assets/car-' + b.group + '.jpg" alt=""><div><b>Grupp ' + b.group + '</b><span>' + esc(c.name) + '</span></div></td>' +
      '<td><b>' + esc(b.namn) + '</b><span class="sub">' + esc(b.tel) + '</span></td>' +
      '<td class="nowrap">' + b.from + '<span class="sub">→ ' + b.to + '</span></td>' +
      '<td class="nowrap"><b>' + H.kr(pris) + ' kr</b>' + (s && s.extra > 0 ? '<span class="sub warn">+' + H.kr(s.extra) + ' extra km</span>' : '') + '</td>' +
      '<td><span class="pill p-' + b.status + '">' + (STATUS[b.status] || b.status) + '</span></td>' +
      '<td class="aact">' + actions(b) + '</td>' +
    '</tr>';
  }

  function actions(b) {
    if (b.status === 'ny') return '<button class="mini go" data-act="bekrafta" data-id="' + b.id + '">Bekräfta</button><button class="mini" data-act="avboka" data-id="' + b.id + '">Avboka</button>';
    if (b.status === 'bekraftad') return '<button class="mini go" data-act="lamna" data-id="' + b.id + '">Lämna ut</button>';
    if (b.status === 'ute') return '<button class="mini go" data-act="ater" data-id="' + b.id + '">Ta emot</button>';
    return '<button class="mini" data-act="kvitto" data-id="' + b.id + '">Kvitto</button>';
  }

  function tableOf(list, empty) {
    if (!list.length) return '<div class="aempty">' + empty + '</div>';
    return '<div class="atable"><table><thead><tr><th>Bil</th><th>Kund</th><th>Datum</th><th>Pris</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(row).join('') + '</tbody></table></div>';
  }

  function viewIdag() {
    var today = H.iso(new Date());
    var all = H.load();
    var ut = all.filter(function (b) { return b.from === today && (b.status === 'bekraftad' || b.status === 'ny'); });
    var in_ = all.filter(function (b) { return b.to === today && b.status === 'ute'; });
    var nya = all.filter(function (b) { return b.status === 'ny'; });
    return kpis() +
      '<section class="acard"><h2>Lämnas ut idag</h2>' + tableOf(ut, 'Inga utlämningar idag.') + '</section>' +
      '<section class="acard"><h2>Återlämnas idag</h2>' + tableOf(in_, 'Inga återlämningar idag.') + '</section>' +
      '<section class="acard"><h2>Nya förfrågningar</h2>' + tableOf(nya, 'Inget nytt att bekräfta.') + '</section>';
  }

  function viewBok() {
    var all = H.load().slice().sort(function (a, b) { return a.from < b.from ? 1 : -1; });
    return '<section class="acard"><h2>Alla bokningar <span class="cnt">' + all.length + '</span></h2>' +
      tableOf(all, 'Inga bokningar ännu. Gör en på bokningssidan så dyker den upp här.') + '</section>';
  }

  function viewKal() {
    var groups = Object.keys(D);
    var start = new Date();
    var days = [];
    for (var i = 0; i < 14; i++) days.push(H.addDays(H.iso(start), i));
    var wd = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
    var head = days.map(function (d) {
      var dt = new Date(d);
      return '<th><span class="cwd">' + wd[dt.getDay()] + '</span><span class="cdd">' + d.slice(8) + '</span></th>';
    }).join('');
    var body = groups.map(function (g) {
      return '<tr><th class="cg"><img src="assets/car-' + g + '.jpg" alt=""><b>' + g + '</b></th>' +
        days.map(function (d) {
          var n = H.busyOn(d, g);
          return '<td class="' + (n ? 'busy' : 'free') + '" title="' + (n ? n + ' bokad' : 'Ledig') + '">' + (n ? n : '') + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<section class="acard"><h2>Tillgänglighet, 14 dagar</h2>' +
      '<p class="asub">Grönt är ledigt, orange är bokat. Se direkt vilken klass som är fri, utan att bläddra i pärmen.</p>' +
      '<div class="atable cal"><table><thead><tr><th></th>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }

  function render() {
    var v = tab === 'bok' ? viewBok() : tab === 'kal' ? viewKal() : viewIdag();
    $('adminRoot').innerHTML = shell(v);
    document.querySelectorAll('.atab').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.dataset.tab; render(); });
    });
    document.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { act(b.dataset.act, b.dataset.id); });
    });
  }

  /* ---------- protokoll ---------- */
  function act(a, id) {
    var b = H.load().filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    if (a === 'bekrafta') { H.update(id, { status: 'bekraftad' }); render(); return; }
    if (a === 'avboka') { H.update(id, { status: 'avbokad' }); render(); return; }
    if (a === 'lamna') return protokoll(b, 'ut');
    if (a === 'ater') return protokoll(b, 'in');
    if (a === 'kvitto') return kvitto(b);
  }

  function overlay(html) {
    var ov = document.createElement('div');
    ov.className = 'overlay open';
    ov.innerHTML = '<div class="modal wide">' + html + '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    function close() { ov.remove(); document.body.style.overflow = ''; }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return { el: ov, close: close };
  }

  var DMG = ['Fram', 'Höger sida', 'Bak', 'Vänster sida', 'Tak', 'Vindruta', 'Fälgar', 'Insida'];

  function protokoll(b, dir) {
    var c = D[b.group];
    var isOut = dir === 'ut';
    var o = overlay(
      '<div class="m-body">' +
        '<div class="prot-head"><img src="assets/car-' + b.group + '.jpg" alt="">' +
          '<div><h3>' + (isOut ? 'Utlämning' : 'Återlämning') + '</h3>' +
          '<div class="m-model">' + esc(b.namn) + ' · Grupp ' + b.group + ' · ' + esc(c.model) + '</div></div>' +
          '<span class="protid">' + b.id + '</span></div>' +
        '<div class="fieldrow2">' +
          '<div class="field"><label>Mätarställning (km)</label><input type="number" id="pKm" value="' + (isOut ? (b.km_out || '') : (b.km_in || '')) + '" placeholder="t.ex. 45120"></div>' +
          '<div class="field"><label>Bränsle</label><select id="pFuel"><option>Full</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Reserv</option></select></div>' +
        '</div>' +
        '<div class="field"><label>Skador och anmärkningar</label><div class="dmg" id="pDmg">' +
          DMG.map(function (d) { return '<button type="button" class="dchip" data-d="' + d + '">' + d + '</button>'; }).join('') +
        '</div><input type="text" id="pNote" placeholder="Fritext, t.ex. repa på höger dörr"></div>' +
        '<div id="pSettle"></div>' +
        '<div class="protfoot">' +
          '<label class="switch"><input type="checkbox" id="pSign"> Kunden har godkänt protokollet</label>' +
          '<button class="btn btn-primary" id="pSave" style="width:100%;justify-content:center;margin-top:12px">' +
            (isOut ? 'Registrera utlämning' : 'Slutför och räkna ut') + '</button>' +
        '</div>' +
      '</div>');

    o.el.querySelectorAll('.dchip').forEach(function (ch) {
      ch.addEventListener('click', function () { ch.classList.toggle('on'); });
    });

    function preview() {
      if (isOut) return;
      var km = +$('pKm').value || 0;
      var s = H.settle({ group: b.group, from: b.from, to: b.to, km: b.km, fri: b.fri, self: b.self, km_out: b.km_out, km_in: km });
      if (!s) { $('pSettle').innerHTML = ''; return; }
      $('pSettle').innerHTML =
        '<div class="settle"><div class="srow"><span>Körda km</span><b>' + s.driven + ' km</b></div>' +
        '<div class="srow"><span>Ingår</span><b>' + s.incl + ' km</b></div>' +
        (s.over > 0
          ? '<div class="srow warn"><span>Extra km ' + s.over + ' × ' + H.dec(s.rate) + ' kr</span><b>' + H.kr(s.extra) + ' kr</b></div>'
          : '<div class="srow ok"><span>Inom fria km</span><b>0 kr</b></div>') +
        '<div class="srow tot"><span>Att betala</span><b>' + H.kr(s.total) + ' kr</b></div></div>';
    }
    if (!isOut) { $('pKm').addEventListener('input', preview); preview(); }

    $('pSave').addEventListener('click', function () {
      var km = +$('pKm').value || 0;
      if (!km) { alert('Fyll i mätarställning.'); return; }
      if (!$('pSign').checked) { alert('Kunden måste godkänna protokollet.'); return; }
      var dmg = [].slice.call(o.el.querySelectorAll('.dchip.on')).map(function (x) { return x.dataset.d; });
      var note = $('pNote').value.trim();
      var fuel = $('pFuel').value;
      if (isOut) {
        if (b.km_in != null && km > b.km_in) { }
        H.update(b.id, { status: 'ute', km_out: km, fuel_out: fuel, dmg_out: dmg, note_out: note });
      } else {
        if (km < (b.km_out || 0)) { alert('Mätarställningen kan inte vara lägre än vid utlämning (' + b.km_out + ' km).'); return; }
        var s = H.settle({ group: b.group, from: b.from, to: b.to, km: b.km, fri: b.fri, self: b.self, km_out: b.km_out, km_in: km });
        H.update(b.id, { status: 'klar', km_in: km, fuel_in: fuel, dmg_in: dmg, note_in: note, slutpris: s ? s.total : b.pris });
      }
      o.close(); render();
    });
  }

  function kvitto(b) {
    var c = D[b.group], s = H.settle(b);
    overlay('<div class="m-body">' +
      '<h3>Kvitto ' + b.id + '</h3><div class="m-model">' + esc(b.namn) + ' · Grupp ' + b.group + ' · ' + esc(c.model) + '</div>' +
      '<ul class="m-list">' +
        '<li><span>Period</span><b>' + b.from + ' → ' + b.to + '</b></li>' +
        '<li><span>Mätare ut / in</span><b>' + (b.km_out || '–') + ' / ' + (b.km_in || '–') + '</b></li>' +
        (s ? '<li><span>Körda km</span><b>' + s.driven + ' km (' + s.incl + ' ingår)</b></li>' : '') +
        (s && s.extra > 0 ? '<li><span>Extra km</span><b>' + H.kr(s.extra) + ' kr</b></li>' : '') +
        (b.dmg_in && b.dmg_in.length ? '<li><span>Anmärkning</span><b>' + esc(b.dmg_in.join(', ')) + '</b></li>' : '') +
        '<li><span>Totalt</span><b>' + H.kr(b.slutpris || (s ? s.total : b.pris)) + ' kr</b></li>' +
      '</ul><p class="demo-note">Prototyp: här skulle kvittot mejlas eller skrivas ut.</p></div>');
  }
})();
