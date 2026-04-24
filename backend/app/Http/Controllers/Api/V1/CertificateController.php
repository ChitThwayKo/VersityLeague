<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Player;
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
        $ssidRaw = $user->student_staff_id;
        $ssidTrim = is_string($ssidRaw) ? trim($ssidRaw) : (string) ($ssidRaw ?? '');
        $ssidTrim = $ssidTrim !== '' ? $ssidTrim : null;

        $items = Certificate::query()
            ->where(function ($q) use ($user, $ssidTrim): void {
                $q->where('user_id', $user->id);
                if ($ssidTrim !== null) {
                    $q->orWhereRaw('TRIM(COALESCE(student_staff_id, \'\')) = ?', [$ssidTrim]);
                }
            })
            ->with('user:id,name')
            ->orderByRaw('CASE WHEN user_id = ? THEN 0 ELSE 1 END', [$user->id])
            ->orderByDesc('id')
            ->get()
            ->map(function (Certificate $c) use ($ssidTrim): array {
                $certSsid = trim((string) ($c->student_staff_id ?? ''));

                return [
                    'id' => $c->id,
                    'type' => $c->type,
                    'title' => $c->title,
                    'student_staff_id' => $certSsid !== '' ? $certSsid : (string) ($ssidTrim ?? ''),
                    'recipient_name' => $c->recipientDisplayName(),
                    'participate_year_start' => $c->participate_year_start,
                    'participate_year_end' => $c->participate_year_end,
                    'positions_played' => $c->positionsDisplay(),
                    'scored' => $c->scored,
                    'assisted' => $c->assisted,
                    'created_at' => $c->created_at,
                ];
            });

        if ($items->isEmpty() && $ssidTrim !== null) {
            $fallback = $this->buildFallbackFromPlayer($ssidTrim, (string) $user->name);
            if ($fallback !== null) {
                $items = collect([$fallback]);
            }
        }

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

    /**
     * PDF for the signed-in user's player profile when no certificate record exists (matches list fallback).
     */
    public function profilePdf(Request $request): Response
    {
        $user = $request->user();
        $ssid = trim((string) ($user->student_staff_id ?? ''));
        if ($ssid === '') {
            abort(Response::HTTP_NOT_FOUND, 'No student/staff ID on account.');
        }

        $player = Player::query()
            ->whereRaw('TRIM(COALESCE(student_staff_id, \'\')) = ?', [$ssid])
            ->with(['club:id,league_id', 'club.league:id,year'])
            ->first();

        if (! $player) {
            abort(Response::HTTP_NOT_FOUND, 'No player profile found.');
        }

        $fallback = $this->buildFallbackFromPlayer($ssid, (string) $user->name);
        if ($fallback === null) {
            abort(Response::HTTP_NOT_FOUND, 'No player profile found.');
        }

        $ys = $fallback['participate_year_start'];
        $ye = $fallback['participate_year_end'];
        $yearStart = ($ys !== null && $ys !== '') ? (string) $ys : '—';
        $yearEnd = ($ye !== null && $ye !== '') ? (string) $ye : '—';

        [$binary, $filename] = $this->certificatePdf->renderPlayerProfileSummary(
            title: (string) $fallback['title'],
            presentedTo: (string) $fallback['recipient_name'],
            studentStaffId: (string) $fallback['student_staff_id'],
            yearStart: $yearStart,
            yearEnd: $yearEnd,
            positions: (string) $fallback['positions_played'],
            goals: (int) $fallback['scored'],
            assists: (int) $fallback['assisted'],
        );

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function authorizeCertificate(Request $request, Certificate $certificate): void
    {
        $user = $request->user();
        if ((int) $certificate->user_id === (int) $user->id) {
            return;
        }
        $userSsid = trim((string) ($user->student_staff_id ?? ''));
        $certSsid = trim((string) ($certificate->student_staff_id ?? ''));
        if ($userSsid !== '' && $certSsid !== '' && $userSsid === $certSsid) {
            return;
        }

        abort(Response::HTTP_FORBIDDEN, 'You may only access your own certificates.');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildFallbackFromPlayer(string $studentStaffId, string $userName): ?array
    {
        $player = Player::query()
            ->whereRaw('TRIM(COALESCE(student_staff_id, \'\')) = ?', [$studentStaffId])
            ->with(['club:id,league_id', 'club.league:id,year'])
            ->first();

        if (! $player) {
            return null;
        }

        $leagueYear = $player->club?->league?->year;

        return [
            'id' => null,
            'type' => 'certificate',
            'title' => 'Certificate of Participation',
            'student_staff_id' => $studentStaffId,
            'recipient_name' => $player->full_name ?: $userName,
            'participate_year_start' => $leagueYear,
            'participate_year_end' => $leagueYear,
            'positions_played' => $player->position ?: '—',
            'scored' => (int) ($player->fixtureStats()->where('stat_type', 'goal')->sum('quantity') ?: 0),
            'assisted' => (int) ($player->fixtureStats()->where('stat_type', 'assist')->sum('quantity') ?: 0),
            'created_at' => null,
        ];
    }
}
