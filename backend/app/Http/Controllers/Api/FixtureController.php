<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Fixture;
use App\Models\Season;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FixtureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $season = Season::query()->where('is_active', true)->first();

        if (! $season) {
            return response()->json([
                'season' => null,
                'fixtures' => [],
            ]);
        }

        $query = Fixture::query()
            ->where('season_id', $season->id)
            ->with(['homeClub', 'awayClub'])
            ->orderBy('kickoff_at')
            ->orderBy('id');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->boolean('upcoming')) {
            $query->where('kickoff_at', '>=', now()->startOfDay())
                ->whereIn('status', [Fixture::STATUS_SCHEDULED, Fixture::STATUS_POSTPONED]);
        }

        $fixtures = $query->get();

        return response()->json([
            'season' => [
                'id' => $season->id,
                'label' => $season->label,
            ],
            'fixtures' => $fixtures->map(fn (Fixture $f) => $this->toPublicArray($f)),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toPublicArray(Fixture $f): array
    {
        return [
            'id' => $f->id,
            'season_id' => $f->season_id,
            'match_number' => $f->match_number,
            'kickoff_at' => $f->kickoff_at?->toIso8601String(),
            'venue_name' => $f->venue_name,
            'venue_location' => $f->venue_location,
            'competition_name' => $f->competition_name,
            'round_label' => $f->round_label,
            'status' => $f->status,
            'home' => $this->clubSnippet($f->homeClub),
            'away' => $this->clubSnippet($f->awayClub),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function clubSnippet(?Club $club): array
    {
        if (! $club) {
            return ['id' => null, 'name' => '—', 'logo_url' => null];
        }

        return [
            'id' => $club->id,
            'name' => $club->name,
            'logo_url' => $club->logoPublicUrl(),
        ];
    }
}
