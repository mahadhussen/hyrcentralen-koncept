/* Bokningssidan: live prisberäkning medan kunden fyller i. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = window.HC_DATA, H = window.HC;

  /* fyll klassväljaren */
  var sel = $('bGroup');
  Object.keys(D).forEach(function (g) {
    var o = document.createElement('option');
    o.value = g;
    o.textContent = 'Grupp ' + g + ' — ' + D[g].name + ' (' + D[g].seats + ')';
    sel.appendChild(o);
  });

  /* Röd tråd: ta emot val från prislistan och kalkylen */
  var today = H.iso(new Date());
  var p = new URLSearchParams(location.search);
  var grupp = p.get('grupp');
  var dagar = parseInt(p.get('dagar'), 10);
  var km = parseInt(p.get('km'), 10);

  $('bFrom').value = today;
  $('bFrom').min = today;
  $('bTo').value = H.addDays(today, dagar > 0 ? dagar : 3);
  if (grupp && D[grupp]) sel.value = grupp;
  if (km >= 0 && !isNaN(km)) $('bKm').value = km;
  if (p.get('fri') === '1') $('bFri').checked = true;
  if (p.get('self') === '1') $('bSelf').checked = true;

  /* visa att uträkningen följde med */
  if (grupp || dagar || km) {
    var note = document.createElement('div');
    note.className = 'carryover';
    note.textContent = 'Vi tog med din uträkning från prislistan. Ändra fritt, priset räknas om direkt.';
    var form = document.getElementById('bokaForm');
    form.insertBefore(note, form.firstChild);
  }

  function current() {
    return {
      group: sel.value,
      from: $('bFrom').value,
      to: $('bTo').value,
      km: +$('bKm').value || 0,
      fri: $('bFri').checked,
      self: $('bSelf').checked,
      namn: $('bNamn').value.trim(),
      tel: $('bTel').value.trim(),
      epost: $('bEpost').value.trim()
    };
  }

  function render() {
    var o = current();
    $('bTo').min = o.from || today;
    if (o.from && o.to && o.to <= o.from) $('bTo').value = H.addDays(o.from, 1);
    $('kmField').style.display = o.fri ? 'none' : '';

    var c = D[o.group];
    var r = H.quote(current());
    var busy = o.from ? H.busyOn(o.from, o.group) : 0;

    var rows = r.valid ? r.rows.map(function (x) {
      return '<li><span>' + x.t + '</span><b>' + H.kr(x.v) + ' kr</b></li>';
    }).join('') : '';

    $('bSummary').innerHTML =
      '<div class="sumcar"><img src="assets/car-' + o.group + '.jpg" alt="' + c.model + '">' +
        '<div><div class="sumgrp">Grupp ' + o.group + '</div><div class="sumname">' + c.name + '</div>' +
        '<div class="summodel">' + c.model + '</div></div></div>' +
      (r.valid
        ? '<div class="sumtotal"><span class="lbl">Beräknat pris</span>' +
            '<div class="tot">' + H.kr(r.total) + '<small> kr</small></div>' +
            '<div class="sumdays">' + r.days + ' dygn · ' + (o.fri ? 'fria km' : o.km + ' km') + '</div></div>' +
          '<ul class="sumrows">' + rows + '</ul>' +
          (r.tip ? '<div class="sumtip">' + r.tip + '</div>' : '') +
          (busy ? '<div class="sumbusy">' + busy + ' bokning' + (busy > 1 ? 'ar' : '') + ' i grupp ' + o.group + ' den dagen. Vi bekräftar tillgång.</div>' : '')
        : '<div class="sumempty">' + (r.error || 'Fyll i datum') + '</div>') +
      '<div class="sumfine">Alla priser inklusive moms. Självrisk ' +
        H.kr(o.self ? (o.group <= 'D' ? 2500 : 5000) : (o.group <= 'D' ? 10000 : 15000)) +
        ' kr' + (o.self ? ' med reducering' : '') + '.</div>';
  }

  ['bGroup', 'bFrom', 'bTo', 'bKm', 'bFri', 'bSelf'].forEach(function (id) {
    $(id).addEventListener('input', render);
    $(id).addEventListener('change', render);
  });
  render();

  /* skicka bokning */
  $('bSubmit').addEventListener('click', function () {
    var o = current();
    var r = H.quote(o);
    if (!r.valid) { alert('Välj giltiga datum.'); return; }
    if (!o.namn || !o.tel) { alert('Fyll i namn och telefon så vi kan bekräfta.'); return; }
    o.pris = r.total;
    var b = H.add(o);
    var ov = $('bOverlay');
    $('bModal').innerHTML =
      '<div class="m-body" style="text-align:center">' +
        '<div class="okmark">✓</div>' +
        '<h3>Tack ' + b.namn.split(' ')[0] + '!</h3>' +
        '<p class="m-model">Din förfrågan är mottagen. Vi hör av oss på ' + b.tel + ' för att bekräfta.</p>' +
        '<ul class="m-list"><li><span>Bokningsnummer</span><b>' + b.id + '</b></li>' +
        '<li><span>Bilklass</span><b>Grupp ' + b.group + ' — ' + D[b.group].name + '</b></li>' +
        '<li><span>Datum</span><b>' + b.from + ' → ' + b.to + '</b></li>' +
        '<li><span>Beräknat pris</span><b>' + H.kr(b.pris) + ' kr</b></li></ul>' +
        '<a class="btn btn-primary" href="index.html" style="width:100%;justify-content:center">Till startsidan</a>' +
        '<p class="demo-note">Prototyp: bokningen syns nu i adminvyn.</p>' +
      '</div>';
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    ov.addEventListener('click', function (e) { if (e.target === ov) { ov.classList.remove('open'); document.body.style.overflow = ''; } });
  });
})();
