# Zyklus

**Kapitel 7 · Help.Cycles · Dokumentationsversion 1.0.0**

Analyse abgeschlossener Verdichterzyklen und deren Qualität.

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
<h1>NPS – Zyklus</h1>
<p>Die Detailseite betrachtet einzelne abgeschlossene Verdichterläufe. Dadurch lässt sich beurteilen, wie lange ein Zyklus lief, welchem Zweck er diente, wie viel Strom und Wärme umgesetzt wurden, welchen COP er erreichte und wie NPS seine Qualität bewertet.</p>

<h2>Was ist ein Zyklus?</h2>
<p>Ein Zyklus beschreibt einen zusammenhängenden Verdichterlauf vom Start bis zum Ende. NPS unterscheidet insbesondere <b>Heizung</b> und <b>Warmwasser</b>. Beide Zyklustypen sollten bevorzugt jeweils untereinander verglichen werden.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Typ</td><td>Zweck des Zyklus, insbesondere Heizung oder Warmwasser.</td></tr>
<tr><td>Start / Ende</td><td>Zeitpunkte des Beginns und Abschlusses.</td></tr>
<tr><td>Dauer</td><td>Gesamte Laufzeit des Zyklus.</td></tr>
<tr><td>Strom</td><td>Während des Zyklus eingesetzte elektrische Energie.</td></tr>
<tr><td>Wärme</td><td>Während des Zyklus erzeugte thermische Energie.</td></tr>
<tr><td>COP</td><td>Verhältnis von Wärme zu Strom des abgeschlossenen Zyklus.</td></tr>
<tr><td>Ø Frequenz</td><td>Mittlere Verdichterfrequenz während des Zyklus.</td></tr>
<tr><td>Qualität</td><td>NPS-Zyklusbewertung von 0 bis 100 %.</td></tr>
</table>

<h2>Zyklusqualität</h2>
<table>
<tr><th>Qualität</th><th>Bewertung</th></tr>
<tr><td>95–100 %</td><td><span class="good">●</span> hervorragend</td></tr>
<tr><td>85–&lt;95 %</td><td><span class="green">●</span> gut</td></tr>
<tr><td>70–&lt;85 %</td><td><span class="yellow">●</span> normal</td></tr>
<tr><td>50–&lt;70 %</td><td><span class="orange">●</span> auffällig</td></tr>
<tr><td>1–&lt;50 %</td><td><span class="red">●</span> kritisch</td></tr>
<tr><td>0 %</td><td><span class="grey">●</span> Sonderfall / keine reguläre Bewertung</td></tr>
</table>

<h2>Zyklushistorie</h2>
<p>Die Historie zeigt Start, Typ, Dauer, COP, Wärme, Strom und Qualität der letzten abgeschlossenen Zyklen. Besonders sinnvoll ist der Vergleich gleicher Zyklustypen: Heizung mit Heizung, Warmwasser mit Warmwasser.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Zyklusdauer</td><td><code>#42A5F5</code></td></tr>
<tr><td>Zyklusqualität</td><td><code>#66BB6A</code></td></tr>
</table>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Langer Heizzyklus + guter COP + hohe Qualität</td><td>Spricht grundsätzlich für einen gleichmäßigen und effizienten Heizbetrieb.</td></tr>
<tr><td>Kurzer Zyklus + niedrige Qualität</td><td>Kann auf ungünstiges Taktverhalten hinweisen; Wiederholungen beobachten.</td></tr>
<tr><td>Kurzer Warmwasserzyklus + gute Qualität</td><td>Kann vollkommen normal sein.</td></tr>
<tr><td>Mehrere Heizzyklen mit niedriger Qualität</td><td>Verdichter-, Temperatur- und Effizienzdaten derselben Zeiträume untersuchen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Nicht einen einzelnen Zyklus optimieren, sondern Muster beurteilen. Ein einzelner kurzer oder ineffizienter Zyklus kann durch einen besonderen Betriebszustand entstehen.</div>
</div>

```
