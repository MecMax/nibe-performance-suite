# Ereignisse

**Kapitel 8 · Help.Events · Dokumentationsversion 1.0.0**

Zeitliche Nachverfolgung wichtiger NPS-Ereignisse und deren Kritikalität.

> Quelle: `scripts/10_NPS_DashboardData.js` → `HELP_DOCUMENTATION`. Die technische Single Source of Truth bleibt DashboardData.

## Gerendertes HTML des Datenpunkts

```html

<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Ereignisse</h1>
<p>Die Detailseite dokumentiert relevante Zustandsänderungen und besondere Vorgänge, die von NPS erkannt werden. Sie hilft dabei, den zeitlichen Ablauf des Anlagenbetriebs nachzuvollziehen und Auffälligkeiten mit anderen NPS-Daten in Verbindung zu bringen.</p>

<h2>Typische Ereignisse</h2>
<p>Beispiele sind Beginn oder Ende eines Heiz- oder Warmwasserzyklus, Verdichterstart oder -stopp, Aktivierung der Zusatzheizung, Enteisungsbeginn oder -ende sowie Warnungen oder Fehler innerhalb der NPS-Verarbeitung.</p>

<h2>Statusanzeigen</h2>
<table>
<tr><th>Anzeige</th><th>Bedeutung</th></tr>
<tr><td>Zyklus aktiv</td><td>Ob aktuell ein erfasster Betriebszyklus läuft.</td></tr>
<tr><td>Verdichter</td><td>Ob der Verdichter momentan aktiv ist.</td></tr>
<tr><td>Zusatzheizung</td><td>Ob aktuell elektrische Zusatzheizung eingesetzt wird.</td></tr>
<tr><td>Enteisung</td><td>Ob momentan ein Enteisungsvorgang läuft.</td></tr>
<tr><td>Aktueller Prozess / Status</td><td>Von NPS erkannter Betriebszustand.</td></tr>
</table>

<h2>Statusfarben</h2>
<table>
<tr><td>Aktiv</td><td><code>#C45A32</code></td></tr>
<tr><td>Inaktiv</td><td><code>#78909C</code></td></tr>
<tr><td>Unbekannt</td><td>Grau</td></tr>
</table>
<p class="small">Diese Farben kennzeichnen Zustände und sind keine Qualitätsampel.</p>

<h2>Kritikalität</h2>
<table>
<tr><th>Kritikalität</th><th>Bedeutung</th></tr>
<tr><td>info</td><td>Informative Meldung über einen normalen Zustand oder Vorgang.</td></tr>
<tr><td>success</td><td>Vorgang wurde erfolgreich bzw. erwartungsgemäß abgeschlossen.</td></tr>
<tr><td>warning</td><td>Auffälligkeit, die beobachtet bzw. geprüft werden sollte.</td></tr>
<tr><td>error</td><td>Fehler oder Vorgang, der eine genauere Untersuchung erfordert.</td></tr>
</table>

<h2>NPS-Ereignis und NIBE-Alarm</h2>
<p>Ein NPS-Ereignis ist nicht automatisch ein NIBE-Alarm. NPS erzeugt eigene Ereignisse zur Dokumentation von Betriebsabläufen und internen Zustandsänderungen. Ein NIBE-Alarm stammt dagegen aus der Wärmepumpensteuerung selbst.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>info bei normalem Betriebswechsel</td><td>Reine Betriebsinformation.</td></tr>
<tr><td>success nach Abschluss</td><td>Erwartungsgemäß abgeschlossener Prozess.</td></tr>
<tr><td>warning einmalig</td><td>Ursache und zeitlichen Zusammenhang prüfen.</td></tr>
<tr><td>wiederkehrende warning-Meldungen</td><td>Interessanter als ein einzelner Ausreißer.</td></tr>
<tr><td>error</td><td>Mit Systemstatus, NIBE-Alarmstatus und Messwerten zum selben Zeitpunkt vergleichen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Ereignisse liefern Kontext, keine alleinige Diagnose. Besonders aussagekräftig sind die Reihenfolge mehrerer Ereignisse und die gleichzeitig aufgezeichneten Messwerte.</div>
</div>

```
