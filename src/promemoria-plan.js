/* Pianificazione dei promemoria dell'orto (logica pura, senza dipendenze: si può collaudare a parte).
   Regole per non essere invasivi:
   - al massimo UNA notifica al giorno (raccolta e acqua si uniscono);
   - annaffiatura/controllo a cadenza fissa e solo da marzo a novembre (3 giorni in estate, 4 in
     primavera/autunno, 7 a marzo e novembre), in orari sensati (mattina presto d'estate);
   - raccolta una sola volta, il giorno in cui la verdura è pronta;
   - si programmano solo i prossimi 14 giorni: se non apri l'app si fermano da sole. */
var DAY = 864e5;

function cadence(month) { // month 1-12
  if (month >= 6 && month <= 8) return 3;
  if (month === 4 || month === 5 || month === 9 || month === 10) return 4;
  if (month === 3 || month === 11) return 7;
  return 0; // dicembre-febbraio: nessun promemoria di acqua
}
function waterHour(month) { return month >= 6 && month <= 9 ? [7, 30] : [9, 30]; }
var HARVEST_HOUR = [9, 30];

function dayKey(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function dayNumber(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); }
function list(names) {
  names = names.slice(0, 3);
  if (names.length < 2) return names.join("");
  return names.slice(0, -1).join(", ") + " e " + names[names.length - 1];
}

/* garden: [{id, d: ms di messa a dimora}], BY: {id: verdura}, settings: {w:bool, h:bool}, now: ms */
export function planReminders(garden, BY, settings, now, days) {
  var out = [];
  if (!garden || !garden.length || !settings || (!settings.w && !settings.h)) return out;
  days = days || 14;
  var start = new Date(now);
  for (var i = 0; i <= days; i++) {
    var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    var month = day.getMonth() + 1, key = dayKey(day), num = dayNumber(day);
    var ready = [], thirsty = [];
    garden.forEach(function (g) {
      var v = BY[g.id]; if (!v) return;
      var avg = (v.d[0] + v.d[1]) / 2;
      var rd = new Date(g.d + avg * DAY);
      if (settings.h && dayKey(rd) === key) ready.push(v.n);
      if (settings.w && v.water >= 2) thirsty.push(v.n);
    });
    var doWater = settings.w && thirsty.length && cadence(month) && num % cadence(month) === 0;
    if (!doWater) thirsty = [];
    if (!ready.length && !thirsty.length) continue;
    var hm = thirsty.length ? waterHour(month) : HARVEST_HOUR;
    var at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hm[0], hm[1], 0);
    if (at.getTime() <= now + 60e3) continue;
    var title, body;
    var others = thirsty.filter(function (n) { return ready.indexOf(n) < 0; });
    if (ready.length && others.length) {
      title = "Nel tuo orto";
      body = "Pronte da raccogliere: " + list(ready) + ". Controlla anche il terreno di " + list(others) + ": se è asciutto, annaffia.";
    } else if (ready.length) {
      title = "Pronte da raccogliere";
      body = ready.length === 1 ? list(ready) + " è pronta nel tuo orto." : list(ready) + " sono pronte nel tuo orto.";
    } else {
      title = "Controlla l'orto";
      body = "Guarda se il terreno è asciutto: " + list(thirsty) + " hanno bisogno d'acqua.";
    }
    out.push({ id: key, title: title, body: body, at: at.getTime() });
  }
  return out;
}
