<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Fixture;
use App\Models\League;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicFixtureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $leagueId = $this->resolveLeagueId($request);

        $query = Fixture::query()
            ->with(['league:id,name,season', 'homeClub:id,club_name,club_photo', 'awayClub:id,club_name,club_photo'])
            ->whereIn('status', ['upcoming', 'finished', 'postponed'])
            ->orderBy('match_date')
            ->orderBy('match_time');

        if ($leagueId !== null) {
            $query->where('league_id', $leagueId);
        }

        $fixtures = $query->get()->map(fn (Fixture $f) => $this->serializeFixture($f));

        return response()->json(['fixtures' => $fixtures]);
    }

    public function show(Fixture $fixture): JsonResponse
    {
        $fixture->load(['league:id,name,season', 'homeClub:id,club_name,club_photo', 'awayClub:id,club_name,club_photo']);

        return response()->json(['fixture' => $this->serializeFixture($fixture)]);
    }

    private function resolveLeagueId(Request $request): ?int
    {
        if ($request->filled('league_id')) {
            return $request->integer('league_id');
        }

        return League::query()->where('status', 'active')->value('id');
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
            'league' => $fixture->relationLoaded('league') && $fixture->league
                ? ['id' => $fixture->league->id, 'name' => $fixture->league->name, 'season' => $fixture->league->season]
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
