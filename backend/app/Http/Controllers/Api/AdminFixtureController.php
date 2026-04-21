<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fixture;
use App\Models\MatchResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminFixtureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Fixture::query()
            ->with(['homeClub', 'awayClub', 'season', 'result'])
            ->orderByDesc('kickoff_at')
            ->orderByDesc('id');

        if ($request->filled('season_id')) {
            $query->where('season_id', (int) $request->query('season_id'));
        }

        $fixtures = $query->get();

        return response()->json([
            'fixtures' => $fixtures->map(fn (Fixture $f) => $this->formatFixtureAdmin($f)),
        ]);
    }

    public function show(Fixture $fixture): JsonResponse
    {
        $fixture->load(['homeClub', 'awayClub', 'season', 'result']);

        return response()->json(['fixture' => $this->formatFixtureAdmin($fixture)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateCreate($request);

        $fixture = Fixture::query()->create($data);
        $fixture->load(['homeClub', 'awayClub', 'season', 'result']);

        return response()->json(['fixture' => $this->formatFixtureAdmin($fixture)], 201);
    }

    public function update(Request $request, Fixture $fixture): JsonResponse
    {
        $data = $this->validateUpdate($request);
        $homeId = (int) ($data['home_club_id'] ?? $fixture->home_club_id);
        $awayId = (int) ($data['away_club_id'] ?? $fixture->away_club_id);
        if ($homeId === $awayId) {
            throw ValidationException::withMessages([
                'away_club_id' => ['Home and away clubs must be different.'],
            ]);
        }
        if ($data !== []) {
            $fixture->update($data);
        }
        $fixture->refresh();
        $fixture->load(['homeClub', 'awayClub', 'season', 'result']);

        return response()->json(['fixture' => $this->formatFixtureAdmin($fixture)]);
    }

    public function destroy(Fixture $fixture): JsonResponse
    {
        $fixture->result()?->delete();
        $fixture->delete();

        return response()->json(['message' => 'Fixture deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    public function formatFixtureAdmin(Fixture $f): array
    {
        $r = $f->result;

        return [
            'id' => $f->id,
            'season_id' => $f->season_id,
            'season_label' => $f->season?->label,
            'match_number' => $f->match_number,
            'kickoff_at' => $f->kickoff_at?->toIso8601String(),
            'venue_name' => $f->venue_name,
            'venue_location' => $f->venue_location,
            'competition_name' => $f->competition_name,
            'round_label' => $f->round_label,
            'status' => $f->status,
            'home_club_id' => $f->home_club_id,
            'away_club_id' => $f->away_club_id,
            'home' => [
                'id' => $f->homeClub?->id,
                'name' => $f->homeClub?->name,
                'logo_url' => $f->homeClub?->logoPublicUrl(),
            ],
            'away' => [
                'id' => $f->awayClub?->id,
                'name' => $f->awayClub?->name,
                'logo_url' => $f->awayClub?->logoPublicUrl(),
            ],
            'result' => $r ? [
                'home_goals' => $r->home_goals,
                'away_goals' => $r->away_goals,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateCreate(Request $request): array
    {
        return $request->validate([
            'season_id' => ['required', 'integer', Rule::exists('seasons', 'id')],
            'match_number' => ['nullable', 'string', 'max:64'],
            'home_club_id' => ['required', 'integer', 'exists:clubs,id'],
            'away_club_id' => ['required', 'integer', 'exists:clubs,id', 'different:home_club_id'],
            'kickoff_at' => ['required', 'date'],
            'venue_name' => ['required', 'string', 'max:255'],
            'venue_location' => ['nullable', 'string', 'max:255'],
            'competition_name' => ['required', 'string', 'max:255'],
            'round_label' => ['nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in([
                Fixture::STATUS_SCHEDULED,
                Fixture::STATUS_COMPLETED,
                Fixture::STATUS_POSTPONED,
            ])],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateUpdate(Request $request): array
    {
        return $request->validate([
            'season_id' => ['sometimes', 'integer', Rule::exists('seasons', 'id')],
            'match_number' => ['nullable', 'string', 'max:64'],
            'home_club_id' => ['sometimes', 'integer', 'exists:clubs,id'],
            'away_club_id' => ['sometimes', 'integer', 'exists:clubs,id'],
            'kickoff_at' => ['sometimes', 'date'],
            'venue_name' => ['sometimes', 'string', 'max:255'],
            'venue_location' => ['nullable', 'string', 'max:255'],
            'competition_name' => ['sometimes', 'string', 'max:255'],
            'round_label' => ['nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in([
                Fixture::STATUS_SCHEDULED,
                Fixture::STATUS_COMPLETED,
                Fixture::STATUS_POSTPONED,
            ])],
        ]);
    }
}
