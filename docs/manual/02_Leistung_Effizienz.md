# Leistung & Effizienz

**Kapitel 3 · Help.Performance · Dokumentationsversion 1.0.0**

Aktuelle Wärmeleistung, Live-COP und periodische Effizienzkennzahlen.

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
<h1>NPS – Leistung &amp; Effizienz</h1>
<p>Die Detailseite zeigt, wie effizient die Wärmepumpe elektrische Energie in nutzbare Wärme umsetzt. Sie verbindet aktuelle Leistungswerte mit COP-Kennzahlen und der Aufteilung zwischen Verdichter und Zusatzheizung.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Elektrische Leistung</td><td>Aktuell von der Wärmepumpenanlage aufgenommene elektrische Leistung.</td></tr>
<tr><td>Wärmeleistung</td><td>Aktuell von der Anlage bereitgestellte thermische Leistung.</td></tr>
<tr><td>Live-COP</td><td>Momentanes Verhältnis von Wärmeleistung zu elektrischer Leistung.</td></tr>
<tr><td>COP gesamt</td><td>Verhältnis von erzeugter Wärme zu eingesetzter elektrischer Energie für den Gesamtbetrieb.</td></tr>
<tr><td>COP Heizung</td><td>Effizienz des Betriebs für die Raumheizung.</td></tr>
<tr><td>COP Warmwasser</td><td>Effizienz der Warmwasserbereitung.</td></tr>
<tr><td>Verdichteranteil</td><td>Anteil der erzeugten Wärmemenge, der vom Verdichter bereitgestellt wurde.</td></tr>
<tr><td>Zusatzheizungsanteil</td><td>Anteil der Wärmemenge aus der elektrischen Zusatzheizung.</td></tr>
</table>

<h2>COP verstehen</h2>
<p><b>COP = erzeugte Wärme ÷ eingesetzte elektrische Energie.</b> Ein COP von 4,0 bedeutet beispielsweise, dass aus 1 kWh elektrischer Energie rechnerisch etwa 4 kWh Wärme bereitgestellt wurden.</p>
<p>Der Live-COP ist eine Momentaufnahme und kann kurzfristig deutlich schwanken. Periodische COP-Werte über längere Zeiträume sind für die Effizienzbewertung aussagekräftiger.</p>

<h2>COP-Ampel</h2>
<table>
<tr><th>COP</th><th>Bewertung</th></tr>
<tr><td>≥ 4,5</td><td><span class="good">●</span> hervorragend</td></tr>
<tr><td>3,8–&lt;4,5</td><td><span class="green">●</span> gut</td></tr>
<tr><td>3,0–&lt;3,8</td><td><span class="yellow">●</span> normal</td></tr>
<tr><td>2,2–&lt;3,0</td><td><span class="orange">●</span> auffällig</td></tr>
<tr><td>0,1–&lt;2,2</td><td><span class="red">●</span> kritisch</td></tr>
<tr><td>&lt;0,1</td><td><span class="grey">●</span> keine sinnvolle Bewertung / inaktiv</td></tr>
</table>

<h2>Verdichter- und Zusatzheizungsanteil</h2>
<p>Verdichteranteil und Zusatzheizungsanteil ergänzen sich grundsätzlich zu ungefähr 100 %. Ein hoher Verdichteranteil ist energetisch meist günstig. Zusatzheizung ist jedoch nicht automatisch ein Fehler und kann bei hoher Last oder besonderen Betriebszuständen erforderlich sein.</p>

<h2>Leistung ist nicht Energie</h2>
<p><b>kW</b> beschreibt die momentane Leistung. <b>kWh</b> beschreibt die über einen Zeitraum aufsummierte Energiemenge.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Hoher COP + hoher Verdichteranteil</td><td>Energetisch günstiger Wärmepumpenbetrieb.</td></tr>
<tr><td>Niedriger Live-COP für kurze Zeit</td><td>Noch kein Hinweis auf ein Problem; Betriebsart und Verlauf betrachten.</td></tr>
<tr><td>COP Warmwasser niedriger als COP Heizung</td><td>Grundsätzlich erwartbar, da höhere Temperaturen erforderlich sind.</td></tr>
<tr><td>Zusatzheizungsanteil steigt</td><td>Ursache prüfen, aber nicht automatisch als Störung bewerten.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Einzelne COP-Werte nie isoliert bewerten. Außentemperatur, Vorlauftemperatur, Betriebsart, Warmwasserbereitung, Enteisung und Zusatzheizung beeinflussen die Effizienz.</div>
</div>

```
