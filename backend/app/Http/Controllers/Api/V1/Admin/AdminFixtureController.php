<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreFixtureRequest;
use App\Http\Requests\Api\V1\Admin\UpdateFixtureRequest;
use App\Models\Fixture;
use App\Services\StandingsRecalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminFixtureController extends Controller
{
    public function __construct(
        private readonly StandingsRecalculationService $standings,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Fixture::query()
            ->with(['league:id,name,year,starts_on,ends_on', 'homeClub:id,club_name', 'awayClub:id,club_name'])
            ->orderBy('match_date')
            ->orderBy('match_time');

        if ($request->filled('league_id')) {
            $query->where('league_id', $request->integer('league_id'));
        }

        $fixtures = $query->get()->map(fn (Fixture $f) => $this->serializeFixture($f));

        return response()->json(['fixtures' => $fixtures]);
    }

    public function store(StoreFixtureRequest $request): JsonResponse
    {
        $data = $request->validated();
        $fixture = Fixture::query()->create($data);
        $fixture->load(['league', 'homeClub', 'awayClub']);
        $this->standings->recalculateForLeague((int) $fixture->league_id);

        return response()->json(['fixture' => $this->serializeFixture($fixture)], 201);
    }

    public function update(UpdateFixtureRequest $request, Fixture $fixture): JsonResponse
    {
        $previousLeagueId = (int) $fixture->league_id;
        $fixture->update($request->validated());
        $fixture->load(['league', 'homeClub', 'awayClub']);
        $this->standings->recalculateForLeague((int) $fixture->league_id);
        if ($previousLeagueId !== (int) $fixture->league_id) {
            $this->standings->recalculateForLeague($previousLeagueId);
        }

        return response()->json(['fixture' => $this->serializeFixture($fixture)]);
    }

    public function destroy(Fixture $fixture): JsonResponse
    {
        $leagueId = (int) $fixture->league_id;
        $fixture->delete();
        $this->standings->recalculateForLeague($leagueId);

        return response()->json(['message' => 'Fixture deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeFixture(Fixture $fixture): array
    {
        $matchTime = $fixture->match_time;
        if ($matchTime instanceof \DateTimeInterface) {
            $matchTime = $matchTime->format('H:i:s');
        }

        return [
            'id' => $fixture->id,
            'league_id' => $fixture->league_id,
            'home_club_id' => $fixture->home_club_id,
            'away_club_id' => $fixture->away_club_id,
            'match_date' => $fixture->match_date?->format('Y-m-d'),
            'match_time' => $matchTime,
            'venue' => $fixture->venue,
            'home_score' => $fixture->home_score,
            'away_score' => $fixture->away_score,
            'status' => $fixture->status,
            'created_at' => $fixture->created_at,
            'updated_at' => $fixture->updated_at,
            'league' => $fixture->relationLoaded('league') && $fixture->league
                ? [
                    'id' => $fixture->league->id,
                    'name' => $fixture->league->name,
                    'year' => $fixture->league->year,
                    'starts_on' => $fixture->league->starts_on?->format('Y-m-d'),
                    'ends_on' => $fixture->league->ends_on?->format('Y-m-d'),
                ]
                : null,
            'home_club' => $fixture->relationLoaded('homeClub') && $fixture->homeClub
                ? ['id' => $fixture->homeClub->id, 'club_name' => $fixture->homeClub->club_name]
                : null,
            'away_club' => $fixture->relationLoaded('awayClub') && $fixture->awayClub
                ? ['id' => $fixture->awayClub->id, 'club_name' => $fixture->awayClub->club_name]
                : null,
        ];
    }
}
