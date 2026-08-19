# System

**Kapitel 2 · Help.System · Dokumentationsversion 1.0.0**

Systemzustand, Datenqualität, Health-Bewertung und technische Diagnose.

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
<h1>NPS – System</h1>
<p>Die Detailseite <b>System</b> dient der übergeordneten Zustands- und Datenüberwachung der NIBE Performance Suite. Sie hilft dabei zu unterscheiden, ob ein Problem von der Wärmepumpenanlage selbst, von der Datenbereitstellung oder von einem NPS-Modul ausgeht.</p>

<h2>Anlagenzustand</h2>
<p>Der Anlagenzustand beschreibt die technische Gesamtbewertung der überwachten Wärmepumpenanlage. Ein auffälliger Anlagenzustand sollte deshalb anders bewertet werden als ein reines Daten- oder NPS-Problem.</p>

<h2>NPS Health</h2>
<p><b>NPS Health</b> ist ein Wert zwischen 0 und 100 %. Er bewertet die Qualität und Plausibilität der für NPS verfügbaren Informationen. <b>100 % bedeutet, dass aktuell kein bewertetes Prüfkriterium zu einem Abzug führt.</b> Ein niedriger Health-Wert bedeutet dagegen nicht automatisch, dass die Wärmepumpe eine technische Störung hat.</p>
<table>
<tr><th>Health</th><th>Bewertung</th><th>Bedeutung</th></tr>
<tr><td>≥ 98 %</td><td><span class="good">●</span> hervorragend</td><td>Keine bzw. praktisch keine Einschränkungen</td></tr>
<tr><td>90–&lt;98 %</td><td><span class="green">●</span> gut</td><td>Geringfügige Einschränkungen</td></tr>
<tr><td>80–&lt;90 %</td><td><span class="yellow">●</span> eingeschränkt</td><td>Auffälligkeiten sollten geprüft werden</td></tr>
<tr><td>60–&lt;80 %</td><td><span class="orange">●</span> deutlich eingeschränkt</td><td>Mehrere oder relevante Einschränkungen</td></tr>
<tr><td>&lt;60 %</td><td><span class="red">●</span> kritisch</td><td>NPS-Daten bzw. Auswertung deutlich beeinträchtigt</td></tr>
</table>

<h2>Health-Berechnungsdetails</h2>
<p>Die Tabelle zeigt nur tatsächlich wirksame Abzüge. Enthalten sind Kriterium, Abzug, Ursache, Details und Berechnungszeitpunkt. Bei 100 % Health sind keine Abzüge vorhanden.</p>

<h2>Datenqualität, Modulstatus und Fehlerzähler</h2>
<p><b>Daten gültig</b> zeigt, ob die für die Darstellung benötigten Eingangsdaten verwendbar sind. <b>Modulstatus</b> zeigt den Zustand der beteiligten NPS-Module. <b>Fehlerzähler</b> unterstützen die Diagnose; ein Wert größer als null weist auf registrierte Fehler hin, beschreibt aber noch nicht Ursache oder Schwere.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td><b>Anlagenzustand OK + Health 100 %</b></td><td>Anlage und NPS-Datenlage sind unauffällig.</td></tr>
<tr><td><b>Anlagenzustand OK + Health 85 %</b></td><td>Die Anlage kann technisch in Ordnung sein; NPS hat jedoch Einschränkungen erkannt.</td></tr>
<tr><td><b>Anlagenzustand auffällig + Health 100 %</b></td><td>Die Datenbasis ist gut, gleichzeitig liegt ein technischer Anlagenhinweis vor.</td></tr>
<tr><td><b>Health niedrig + Modulstatus nicht OK</b></td><td>Ein Problem innerhalb der Datenverarbeitung bzw. eines NPS-Moduls ist wahrscheinlich.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Anlagenzustand und NPS Health sind zwei unterschiedliche Bewertungen. Der Anlagenzustand beschreibt den technischen Zustand der Wärmepumpenanlage, NPS Health dagegen die Qualität, Vollständigkeit und Plausibilität der für NPS verfügbaren Informationen.</div>
</div>

```
