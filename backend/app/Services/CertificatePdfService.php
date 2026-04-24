<?php

namespace App\Services;

use App\Models\Certificate;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CertificatePdfService
{
    /**
     * Render PDF bytes for a certificate (layout matches public certificate modal).
     *
     * @return array{0: string, 1: string} [binary pdf, suggested filename]
     */
    public function render(Certificate $certificate): array
    {
        $certificate->loadMissing('user');

        $recipientName = $certificate->recipientDisplayName();
        $ssid = trim((string) ($certificate->student_staff_id ?? ''));
        $ys = $certificate->participate_year_start;
        $ye = $certificate->participate_year_end;
        $participationYears = ($ys !== null && $ye !== null) ? "{$ys} – {$ye}" : '—';

        $pdf = Pdf::loadView('certificates.participation_pdf', $this->participationViewData(
            title: (string) $certificate->title,
            recipientName: $recipientName,
            studentStaffId: $ssid !== '' ? $ssid : '—',
            participationYears: $participationYears,
            positions: $certificate->positionsDisplay(),
            goals: (int) $certificate->scored,
            assists: (int) $certificate->assisted,
        ))->setPaper('a4', 'landscape');

        $filename = 'versity-certificate-'.$certificate->id.'.pdf';

        return [$pdf->output(), $filename];
    }

    /**
     * PDF for signed-in users who have a player profile but no issued certificate row yet.
     *
     * @return array{0: string, 1: string} [binary pdf, suggested filename]
     */
    public function renderPlayerProfileSummary(
        string $title,
        string $presentedTo,
        string $studentStaffId,
        string $yearStart,
        string $yearEnd,
        string $positions,
        int $goals,
        int $assists,
    ): array {
        $ys = trim($yearStart);
        $ye = trim($yearEnd);
        $participationYears = ($ys !== '' && $ys !== '—' && $ye !== '' && $ye !== '—')
            ? "{$ys} – {$ye}"
            : (($ys !== '' && $ys !== '—') ? $ys : (($ye !== '' && $ye !== '—') ? $ye : '—'));

        $pdf = Pdf::loadView('certificates.participation_pdf', $this->participationViewData(
            title: $title,
            recipientName: $presentedTo,
            studentStaffId: trim($studentStaffId) !== '' ? trim($studentStaffId) : '—',
            participationYears: $participationYears,
            positions: $positions !== '' ? $positions : '—',
            goals: $goals,
            assists: $assists,
        ))->setPaper('a4', 'landscape');

        $safe = Str::slug($studentStaffId, '-') ?: 'profile';
        $filename = 'versity-certificate-'.$safe.'.pdf';

        return [$pdf->output(), $filename];
    }

    /**
     * Write PDF to the public disk and persist file_path on the model.
     */
    public function writeToPublicDisk(Certificate $certificate): void
    {
        [$binary] = $this->render($certificate);

        $path = 'certificates/cert-'.$certificate->id.'.pdf';
        Storage::disk('public')->put($path, $binary);
        $certificate->update(['file_path' => $path]);
    }

    /**
     * @return array<string, mixed>
     */
    private function participationViewData(
        string $title,
        string $recipientName,
        string $studentStaffId,
        string $participationYears,
        string $positions,
        int $goals,
        int $assists,
    ): array {
        return [
            'logoDataUri' => $this->uniLogoDataUri(),
            'title' => $title,
            'recipientName' => $recipientName !== '' ? $recipientName : '—',
            'studentStaffId' => $studentStaffId,
            'participationYears' => $participationYears,
            'positions' => $positions,
            'goals' => $goals,
            'assists' => $assists,
        ];
    }

    private function uniLogoDataUri(): ?string
    {
        $candidates = [
            dirname(base_path()).DIRECTORY_SEPARATOR.'img'.DIRECTORY_SEPARATOR.'UniLogo1.png',
            public_path('img'.DIRECTORY_SEPARATOR.'UniLogo1.png'),
        ];

        foreach ($candidates as $path) {
            if (! is_string($path) || $path === '' || ! is_readable($path)) {
                continue;
            }
            $bin = @file_get_contents($path);
            if ($bin !== false && $bin !== '') {
                return 'data:image/png;base64,'.base64_encode($bin);
            }
        }

        return null;
    }
}
