# Enteisung

**Kapitel 9 · Help.Defrost · Dokumentationsversion 1.0.0**

Erkennung und zeitliche Analyse von Abtauvorgängen der Außeneinheit.

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
<h1>NPS – Enteisung</h1>
<p>Die Detailseite zeigt die von NPS erkannten Abtauvorgänge der Außeneinheit. Sie hilft zu beurteilen, wann und wie häufig enteist wird, wie lange die Vorgänge dauern und wie sich die Anlage während einer Enteisung verhält.</p>

<h2>Warum wird enteist?</h2>
<p>Im Heizbetrieb kann sich unter geeigneten Temperatur- und Feuchtebedingungen Eis am Verdampfer bilden. Diese Vereisung behindert den Wärmeübergang. Die Wärmepumpe muss deshalb regelmäßig einen Enteisungs- bzw. Abtauvorgang durchführen.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Enteisung aktiv</td><td>Ob aktuell ein Enteisungsvorgang läuft.</td></tr>
<tr><td>Anzahl</td><td>Anzahl der von NPS erkannten Enteisungsvorgänge.</td></tr>
<tr><td>Abgeschlossene Enteisungen</td><td>Anzahl vollständig erkannter bzw. abgeschlossener Vorgänge.</td></tr>
<tr><td>Aktuelle Dauer</td><td>Bisherige Dauer einer momentan laufenden Enteisung.</td></tr>
<tr><td>Letzte Dauer</td><td>Dauer des zuletzt abgeschlossenen Enteisungsvorgangs.</td></tr>
<tr><td>Letzter Start</td><td>Zeitpunkt, zu dem die letzte Enteisung begonnen hat.</td></tr>
</table>

<h2>Keine pauschale Ampel</h2>
<p>NPS besitzt derzeit keine pauschale Qualitätsampel für Anzahl oder Dauer der Enteisungen. Eine starre Regel wie „mehr als x Enteisungen pro Tag = schlecht“ wäre ohne Berücksichtigung von Wetter- und Betriebsbedingungen irreführend.</p>

<h2>Verhalten während einer Enteisung</h2>
<p>Während des Abtauvorgangs können Verdichterfrequenz, Vorlauf, Rücklauf, Wärmeleistung und Live-COP kurzfristig deutlich verändert sein. Solche Werte sollten nicht wie normaler Heizbetrieb bewertet werden.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Enteisung aktiv</td><td><code>#FF8F00</code></td></tr>
<tr><td>Verdichterfrequenz</td><td><code>#26A69A</code></td></tr>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
</table>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Einzelne Enteisung bei passenden Witterungsbedingungen</td><td>Normaler Betriebsprozess.</td></tr>
<tr><td>Mehrere Enteisungen bei feucht-kühlem Wetter</td><td>Können ebenfalls vollkommen normal sein.</td></tr>
<tr><td>Enteisung aktiv + kurzfristige Veränderung von Vorlauf oder COP</td><td>Während des Abtauvorgangs grundsätzlich plausibel.</td></tr>
<tr><td>Enteisungen werden deutlich häufiger oder länger</td><td>Verlauf genauer untersuchen und mit Außentemperatur sowie Verdichterbetrieb vergleichen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Enteisung ist ein notwendiger Bestandteil des normalen Betriebs einer Luft/Wasser-Wärmepumpe. Nicht der einzelne Abtauvorgang ist entscheidend, sondern das Muster aus Häufigkeit, Dauer, Witterungsbedingungen und Anlagenverhalten.</div>
</div>

```
