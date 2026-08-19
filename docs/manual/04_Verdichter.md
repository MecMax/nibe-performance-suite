# Verdichter

**Kapitel 5 · Help.Compressor · Dokumentationsversion 1.0.0**

Aktueller Verdichterzustand, Modulation, Starts und Laufzeiten.

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
<h1>NPS – Verdichter</h1>
<p>Die Detailseite zeigt, wie der Verdichter aktuell arbeitet und wie sich sein Betrieb über den Tag entwickelt. Im Mittelpunkt stehen Aktivstatus, Betriebsart, Frequenz, Starts, Laufzeit, Zyklusdauer und Modulation.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Verdichter aktiv</td><td>Zeigt, ob der Verdichter momentan läuft.</td></tr>
<tr><td>Betriebsart / Zyklustyp</td><td>Ordnet den aktuellen Verdichterlauf dem Betriebszweck zu.</td></tr>
<tr><td>Frequenz</td><td>Aktuelle Verdichterfrequenz in Hz; Maß für den Modulationsgrad.</td></tr>
<tr><td>Starts gesamt / heute</td><td>Kumulierte bzw. heutige Anzahl der Verdichterstarts.</td></tr>
<tr><td>Laufzeit gesamt / heute</td><td>Kumulierte bzw. heutige Verdichterlaufzeit.</td></tr>
<tr><td>Ø Zyklusdauer</td><td>Mittlere Dauer der heutigen Verdichterläufe.</td></tr>
<tr><td>Ø Frequenz</td><td>Zeitgewichtete mittlere Verdichterfrequenz während des heutigen Betriebs.</td></tr>
</table>

<h2>Frequenz und Modulation</h2>
<p>Eine niedrige Frequenz bedeutet geringere momentane Verdichterleistung, eine höhere Frequenz entsprechend mehr Leistung. Eine niedrige Frequenz ist nicht automatisch gut und eine hohe Frequenz nicht automatisch schlecht. Entscheidend ist, ob die Leistung zum aktuellen Bedarf passt.</p>

<h2>Starts und Laufzeit</h2>
<p>Viele Starts innerhalb kurzer Zeit können auf kurze Zyklen hindeuten. Die reine Anzahl reicht jedoch nicht für eine Bewertung aus. Starts und Zyklusdauer sollten immer gemeinsam betrachtet werden. Eine hohe tägliche Laufzeit kann bei kaltem Wetter völlig normal sein.</p>

<h2>Modulationsanalyse</h2>
<p>Ein typischer Verlauf kann lauten: Start → höhere Frequenz → Annäherung an den Wärmebedarf → Abmodulation → längerer stabiler Betrieb. Wiederholte Folgen aus Start → kurzer Lauf → Abschaltung → kurzer Stillstand → erneuter Start können auf häufiges Takten hindeuten.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Verdichterfrequenz</td><td><code>#26A69A</code></td></tr>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
</table>
<p class="small">Kurvenfarben dienen der Wiedererkennung und sind keine Qualitätsbewertung.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Langer Heizzyklus + konstante niedrige/moderate Frequenz</td><td>Spricht grundsätzlich für gleichmäßigen modulierenden Betrieb.</td></tr>
<tr><td>Hohe Frequenz bei niedriger Außentemperatur</td><td>Kann aufgrund höheren Wärmebedarfs völlig normal sein.</td></tr>
<tr><td>Viele Starts + sehr kurze Zyklusdauer</td><td>Mögliches häufiges Takten; Temperaturverlauf, Wärmeabnahme und Regelung prüfen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Verdichterfrequenz, Starts und Laufzeit besitzen für sich allein keine NPS-Qualitätsampel. Erst das Zusammenspiel mit Zyklusdauer, Temperaturen, Außentemperatur, Betriebsart und Effizienz ermöglicht eine sinnvolle Bewertung.</div>
</div>

```
