<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #152154; margin: 24px; }
        h1 { font-size: 22px; margin-bottom: 8px; color: #152154; }
        .meta { font-size: 12px; margin-top: 16px; }
        .meta table { width: 100%; border-collapse: collapse; }
        .meta td { padding: 6px 8px; border-bottom: 1px solid #e0ddd6; }
        .meta td:first-child { font-weight: bold; width: 32%; color: #2c376b; }
        .foot { margin-top: 28px; font-size: 10px; color: #666; }
    </style>
</head>
<body>
    <h1>{{ $certificate->title }}</h1>
    <p style="font-size:14px;">Presented to <strong>{{ $userName }}</strong></p>
    <div class="meta">
        <table>
            <tr><td>Student / staff ID</td><td>{{ $certificate->student_staff_id }}</td></tr>
            <tr><td>Participation</td><td>{{ $certificate->participate_year_start }} – {{ $certificate->participate_year_end }}</td></tr>
            <tr><td>Positions</td><td>{{ $certificate->positions_played }}</td></tr>
            @if ($certificate->scored > 0)
                <tr><td>Goals scored</td><td>{{ $certificate->scored }}</td></tr>
            @endif
            @if ($certificate->assisted > 0)
                <tr><td>Assists</td><td>{{ $certificate->assisted }}</td></tr>
            @endif
        </table>
    </div>
    <p class="foot">Versity League — official certificate. Type: {{ $certificate->type }}</p>
</body>
</html>
