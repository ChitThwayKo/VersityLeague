<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Services\CertificatePdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CertificateController extends Controller
{
    public function __construct(
        private readonly CertificatePdfService $certificatePdf,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $items = Certificate::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->get()
            ->map(static fn (Certificate $c) => [
                'id' => $c->id,
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

    public function pdf(Request $request, Certificate $certificate): Response
    {
        $this->authorizeCertificate($request, $certificate);

        [$binary, $filename] = $this->certificatePdf->render($certificate);

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function authorizeCertificate(Request $request, Certificate $certificate): void
    {
        if ((int) $certificate->user_id !== (int) $request->user()->id) {
            abort(Response::HTTP_FORBIDDEN, 'You may only access your own certificates.');
        }
    }
}
