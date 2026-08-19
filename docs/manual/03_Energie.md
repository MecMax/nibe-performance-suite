# Energie

**Kapitel 4 · Help.Energy · Dokumentationsversion 1.0.0**

Elektrische Energie, Wärmemengen und deren Aufteilung nach Heizung, Warmwasser, Verdichter und Zusatzheizung.

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
<h1>NPS – Energie</h1>
<p>Die Detailseite zeigt die über einen Zeitraum aufsummierten elektrischen und thermischen Energiemengen der Wärmepumpe. Sie beantwortet vor allem: Wie viel Strom wurde eingesetzt, wie viel Wärme daraus erzeugt und mit welcher Effizienz?</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Strom</td><td>Aufgenommene elektrische Energie in kWh.</td></tr>
<tr><td>Wärme gesamt</td><td>Insgesamt bereitgestellte thermische Energie in kWh.</td></tr>
<tr><td>Wärme Heizung</td><td>Wärmemenge für die Raumheizung.</td></tr>
<tr><td>Wärme Warmwasser</td><td>Wärmemenge für die Warmwasserbereitung.</td></tr>
<tr><td>Wärme Verdichter</td><td>Durch den Wärmepumpenprozess erzeugte Wärmemenge.</td></tr>
<tr><td>Wärme Zusatzheizung</td><td>Durch die elektrische Zusatzheizung bereitgestellte Wärmemenge.</td></tr>
<tr><td>COP gesamt / Heizung / Warmwasser</td><td>Energiebezogene Effizienz für den jeweiligen Betrachtungsbereich.</td></tr>
<tr><td>Verdichteranteil / Zusatzheizungsanteil</td><td>Anteile der bereitgestellten Wärme nach Erzeugungsart.</td></tr>
</table>

<h2>Leistung und Energie unterscheiden</h2>
<p><b>kW = Leistung</b>, also momentane Aufnahme oder Erzeugung. <b>kWh = Energie</b>, also über einen Zeitraum aufsummierte Leistung.</p>

<h2>Datenbasis</h2>
<p>Die NPS-Wärmemengen stammen aus den VirtualMeters. Sie bilden die zentrale Datenquelle für die nachfolgenden Energie- und Effizienzberechnungen.</p>

<h2>COP im Energieverlauf</h2>
<p><b>COP = erzeugte Wärmeenergie ÷ eingesetzte elektrische Energie.</b> Für die Bewertung gelten dieselben NPS-Grenzen wie auf der Seite Leistung &amp; Effizienz.</p>

<h2>Zeiträume</h2>
<p>Verglichen werden laufende und abgeschlossene Perioden wie Heute, Gestern, Woche, Monat oder Jahr. Gleich lange bzw. vergleichbare Zeiträume sollten bevorzugt miteinander verglichen werden.</p>

<h2>Diagramme richtig lesen</h2>
<p>Einzelne Ausschläge sind weniger aussagekräftig als Trends und wiederkehrende Veränderungen. Ein sinkender COP sollte gemeinsam mit Außentemperatur, Vorlauf, Warmwasserbetrieb, Zusatzheizung und Enteisungen betrachtet werden.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Stromverbrauch und Wärmemenge steigen ähnlich stark</td><td>Zunächst plausibel bei höherem Wärmebedarf.</td></tr>
<tr><td>Strom steigt deutlich stärker als Wärme</td><td>COP sinkt; Betriebsbedingungen und Zusatzheizung prüfen.</td></tr>
<tr><td>Wärmebedarf steigt bei fallender Außentemperatur</td><td>Grundsätzlich erwartbares Verhalten.</td></tr>
<tr><td>Ein einzelner schlechter Tag</td><td>Noch keine belastbare Aussage; Woche bzw. Monat vergleichen.</td></tr>
</table>

<div class="note"><b>Hinweis:</b> Die dargestellten Energiemengen und COP-Werte sind Auswertungswerte. Ihre Genauigkeit hängt von Qualität und Aktualität der zugrunde liegenden Daten ab.</div>
</div>

```
