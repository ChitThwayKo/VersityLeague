<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class CertificatePdfService
{
    /**
     * Render PDF bytes for a certificate (owner display data from linked user name).
     *
     * @return array{0: string, 1: string} [binary pdf, suggested filename]
     */
    public function render(Certificate $certificate): array
    {
        $certificate->loadMissing('user');

        $userName = $certificate->user instanceof User ? $certificate->user->name : 'Participant';

        $pdf = Pdf::loadView('certificates.pdf', [
            'certificate' => $certificate,
            'userName' => $userName,
        ])->setPaper('a4', 'landscape');

        $filename = 'versity-certificate-'.$certificate->id.'.pdf';

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
}
