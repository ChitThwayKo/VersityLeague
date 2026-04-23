<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Services\CertificatePdfService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class AdminCertificateController extends Controller
{
    public function __construct(
        private readonly CertificatePdfService $certificatePdf,
    ) {}

    public function index(): JsonResponse
    {
        $items = Certificate::query()
            ->with(['user:id,name,email,student_staff_id'])
            ->orderByDesc('id')
            ->get()
            ->map(static fn (Certificate $c) => [
                'id' => $c->id,
                'user_name' => $c->user?->name,
                'user_email' => $c->user?->email,
                'type' => $c->type,
                'title' => $c->title,
                'student_staff_id' => $c->student_staff_id,
                'participate_year_start' => $c->participate_year_start,
                'participate_year_end' => $c->participate_year_end,
                'positions_played' => $c->positions_played,
                'scored' => $c->scored,
                'assisted' => $c->assisted,
                'created_at' => $c->created_at,
            ]);

        return response()->json(['certificates' => $items]);
    }

    public function pdf(Certificate $certificate): Response
    {
        [$binary, $filename] = $this->certificatePdf->render($certificate);

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
