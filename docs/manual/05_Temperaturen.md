# Temperaturen

**Kapitel 6 · Help.Temperatures · Dokumentationsversion 1.0.0**

Temperatur- und Hydraulikwerte für Heizkreis und Warmwasser.

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
<h1>NPS – Temperaturen</h1>
<p>Die Detailseite zeigt die wichtigsten thermischen Betriebsgrößen der Wärmepumpe. Sie hilft zu beurteilen, ob die Anlage die angeforderte Vorlauftemperatur erreicht, wie groß die Differenz zwischen Vor- und Rücklauf ist und unter welchen Außen- und Warmwasserbedingungen die Wärmepumpe arbeitet.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Außentemperatur</td><td>Aktuelle von NPS verwendete Außentemperatur.</td></tr>
<tr><td>Vorlauf SOLL</td><td>Von der Regelung aktuell angeforderte Vorlauftemperatur.</td></tr>
<tr><td>Vorlauf IST</td><td>Tatsächlich gemessene Vorlauftemperatur.</td></tr>
<tr><td>Vorlaufabweichung</td><td>Differenz Vorlauf IST − Vorlauf SOLL in Kelvin.</td></tr>
<tr><td>Rücklauf</td><td>Temperatur des Heizwassers beim Rücklauf zur Wärmepumpe.</td></tr>
<tr><td>Spreizung</td><td>Temperaturdifferenz zwischen Vorlauf und Rücklauf.</td></tr>
<tr><td>Warmwasser oben / BT7</td><td>Temperatur im oberen Bereich des Warmwasserspeichers.</td></tr>
<tr><td>WW-Ladetemperatur / BT6</td><td>Temperatur im Bereich der Warmwasserladung.</td></tr>
<tr><td>Verdichterfrequenz</td><td>Zusätzliche Vergleichsgröße für Temperaturveränderungen und Modulation.</td></tr>
</table>

<h2>Vorlaufabweichung</h2>
<p><b>Vorlaufabweichung = Vorlauf IST − Vorlauf SOLL.</b> Negativ bedeutet kälter als angefordert, 0 K entspricht dem Sollwert, positiv bedeutet wärmer als angefordert. Die beste NPS-Bewertung liegt ungefähr bei −0,5 K bis +0,5 K; mit zunehmender Abweichung wechselt die Bewertung über Grün, Gelb, Orange zu Rot.</p>

<h2>Spreizung</h2>
<p><b>Spreizung = Vorlauf − Rücklauf.</b> Sie hängt unter anderem von Volumenstrom, Wärmeabnahme, Verdichterleistung und Betriebszustand ab. NPS verwendet hierfür keine allgemeine Qualitätsampel.</p>

<h2>Warmwasser BT7 und BT6</h2>
<p><b>BT7</b> beschreibt die Temperatur im oberen Speicherbereich und ist besonders relevant für die verfügbare Warmwassertemperatur. <b>BT6</b> wird zur Beurteilung der Warmwasserladung herangezogen. Beide Messwerte erfüllen unterschiedliche Aufgaben und sollten nicht gleichgesetzt werden.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
<tr><td>Vorlauf IST</td><td><code>#EF6C3E</code></td></tr>
<tr><td>Vorlauf SOLL</td><td><code>#FBC02D</code></td></tr>
<tr><td>Rücklauf</td><td><code>#AB47BC</code></td></tr>
<tr><td>Warmwasser oben / BT7</td><td><code>#EC407A</code></td></tr>
<tr><td>WW-Ladetemperatur / BT6</td><td><code>#FF9800</code></td></tr>
<tr><td>Verdichterfrequenz</td><td><code>#26A69A</code></td></tr>
</table>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Vorlauf IST nahe SOLL</td><td>Regelung erreicht die aktuell angeforderte Temperatur.</td></tr>
<tr><td>Vorlauf IST kurzfristig unter SOLL</td><td>Kann nach Verdichterstart oder bei steigender Wärmeanforderung normal sein.</td></tr>
<tr><td>Vorlauf IST dauerhaft deutlich unter SOLL</td><td>Wärmeleistung, Verdichterfrequenz, Volumenstrom und Betriebszustand mit untersuchen.</td></tr>
<tr><td>BT7 sinkt</td><td>Warmwasservorrat im oberen Speicherbereich kühlt ab bzw. wird genutzt.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Temperaturen immer als System betrachten. Vorlauf, Rücklauf, Sollwert, Außentemperatur und Verdichterfrequenz beeinflussen sich gegenseitig.</div>
</div>

```
