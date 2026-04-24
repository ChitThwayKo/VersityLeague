<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 12mm 12mm;
            font-family: DejaVu Sans, sans-serif;
            color: #152154;
            background: #e8e4dc;
        }
        .shell { width: 100%; }
        .card {
            background: #fff;
            border: 3px solid #e4b84a;
            border-radius: 10px;
            padding: 10mm 11mm 8mm;
        }
        .logo-wrap { text-align: center; margin: 0 0 7mm; }
        .logo { max-width: 78mm; max-height: 22mm; width: auto; height: auto; }
        .title {
            text-align: center;
            font-size: 15pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin: 0 0 2mm;
            color: #152154;
        }
        .subtitle {
            text-align: center;
            font-size: 11pt;
            font-weight: bold;
            letter-spacing: 0.06em;
            margin: 0 0 6mm;
            color: #152154;
        }
        .grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .grid > tbody > tr > td {
            width: 50%;
            vertical-align: top;
            padding: 0 3mm 0 0;
        }
        .grid > tbody > tr > td + td { padding: 0 0 0 3mm; }
        .field { margin: 0 0 5mm; }
        .label {
            font-size: 7.5pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #2c376b;
            margin: 0 0 1mm;
        }
        .val { font-size: 10.5pt; font-weight: bold; color: #152154; margin: 0; }
        .copy {
            text-align: center;
            font-size: 8pt;
            color: #555;
            margin: 7mm 0 0;
        }
    </style>
</head>
<body>
<div class="shell">
    <div class="card">
        @if (!empty($logoDataUri))
            <div class="logo-wrap">
                <img class="logo" src="{{ $logoDataUri }}" alt="" />
            </div>
        @endif
        <div class="title">{{ $title }}</div>
        <div class="subtitle">Versity League</div>
        <table class="grid">
            <tbody>
            <tr>
                <td>
                    <div class="field">
                        <div class="label">Student / staff ID</div>
                        <div class="val">{{ $studentStaffId }}</div>
                    </div>
                    <div class="field">
                        <div class="label">Participated year</div>
                        <div class="val">{{ $participationYears }}</div>
                    </div>
                    <div class="field">
                        <div class="label">Goal</div>
                        <div class="val">{{ $goals }}</div>
                    </div>
                </td>
                <td>
                    <div class="field">
                        <div class="label">Name</div>
                        <div class="val">{{ $recipientName }}</div>
                    </div>
                    <div class="field">
                        <div class="label">Positions</div>
                        <div class="val">{{ $positions }}</div>
                    </div>
                    <div class="field">
                        <div class="label">Assist</div>
                        <div class="val">{{ $assists }}</div>
                    </div>
                </td>
            </tr>
            </tbody>
        </table>
        <p class="copy">© 2026 Versity League. All rights reserved.</p>
    </div>
</div>
</body>
</html>
