/* Promemoria dell'orto: notifiche LOCALI (niente server, niente account).
   Sono spenti finché l'utente non li attiva; il permesso si chiede solo in quel momento. */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { planReminders } from "./promemoria-plan.js";

var KEY = "ortomio-promemoria", CH = "promemoria";
var settings = { w: false, h: false };
var ctx = { getGarden: function () { return []; }, BY: {} };

export function remindersAvailable() { return Capacitor.isNativePlatform(); }
export function reminderSettings() { return { w: settings.w, h: settings.h }; }

export async function initReminders(getGarden, BY) {
  ctx.getGarden = getGarden; ctx.BY = BY;
  if (!remindersAvailable()) return;
  try {
    var raw = (await Preferences.get({ key: KEY })).value;
    var s = raw ? JSON.parse(raw) : null;
    if (s) settings = { w: !!s.w, h: !!s.h };
  } catch (e) {}
  await rescheduleReminders();
}

async function save() { try { await Preferences.set({ key: KEY, value: JSON.stringify(settings) }); } catch (e) {} }

async function allowed(ask) {
  try {
    var p = await LocalNotifications.checkPermissions();
    if (p.display === "granted") return true;
    if (!ask) return false;
    p = await LocalNotifications.requestPermissions();
    return p.display === "granted";
  } catch (e) { return false; }
}

/* Ritorna false se l'utente nega il permesso (l'interruttore resta spento). */
export async function setReminder(kind, on) {
  if (!remindersAvailable()) return false;
  if (on && !(await allowed(true))) return false;
  settings[kind] = !!on;
  await save();
  await rescheduleReminders();
  return true;
}

/* Da richiamare all'avvio e ogni volta che l'orto cambia. */
export async function rescheduleReminders() {
  if (!remindersAvailable()) return;
  try {
    var pend = await LocalNotifications.getPending();
    if (pend.notifications && pend.notifications.length) {
      await LocalNotifications.cancel({ notifications: pend.notifications.map(function (n) { return { id: n.id }; }) });
    }
    if (!(settings.w || settings.h) || !(await allowed(false))) return;
    await LocalNotifications.createChannel({ id: CH, name: "Promemoria dell'orto", description: "Annaffiatura, controllo e raccolta", importance: 3 });
    var plan = planReminders(ctx.getGarden(), ctx.BY, settings, Date.now(), 14);
    if (!plan.length) return;
    await LocalNotifications.schedule({
      notifications: plan.map(function (r) {
        return { id: r.id, title: r.title, body: r.body, channelId: CH, schedule: { at: new Date(r.at), allowWhileIdle: true } };
      })
    });
  } catch (e) { /* mai bloccare l'app per un promemoria */ }
}
