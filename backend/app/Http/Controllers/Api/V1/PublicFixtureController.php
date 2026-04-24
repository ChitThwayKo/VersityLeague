<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Fixture;
use App\Models\League;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicFixtureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $leagueId = $this->resolveLeagueId($request);

        $query = Fixture::query()
            ->with(['league:id,name,year,starts_on,ends_on', 'homeClub:id,club_name,club_photo', 'awayClub:id,club_name,club_photo'])
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
        $fixture->load([
            'league:id,name,year,starts_on,ends_on',
            'homeClub:id,club_name,club_photo',
            'awayClub:id,club_name,club_photo',
            'playerStats:id,fixture_id,player_id,stat_type,quantity',
            'playerStats.player:id,club_id,full_name',
        ]);

        return response()->json(['fixture' => $this->serializeFixture($fixture, includeStats: true)]);
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
    private function serializeFixture(Fixture $fixture, bool $includeStats = false): array
    {
        $matchTime = $fixture->match_time;
        if ($matchTime instanceof \DateTimeInterface) {
            $matchTime = $matchTime->format('H:i:s');
        }

        $row = [
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
                ? [
                    'id' => $fixture->league->id,
                    'name' => $fixture->league->name,
                    'year' => $fixture->league->year,
                    'starts_on' => $fixture->league->starts_on?->format('Y-m-d'),
                    'ends_on' => $fixture->league->ends_on?->format('Y-m-d'),
                ]
                : null,
            'home_club' => $fixture->relationLoaded('homeClub') && $fixture->homeClub
                ? [
                    'id' => $fixture->homeClub->id,
                    'club_name' => $fixture->homeClub->club_name,
                    'club_photo_url' => $fixture->homeClub->club_photo
                        ? PublicStorageUrl::url($fixture->homeClub->club_photo)
                        : null,
                ]
                : null,
            'away_club' => $fixture->relationLoaded('awayClub') && $fixture->awayClub
                ? [
                    'id' => $fixture->awayClub->id,
                    'club_name' => $fixture->awayClub->club_name,
                    'club_photo_url' => $fixture->awayClub->club_photo
                        ? PublicStorageUrl::url($fixture->awayClub->club_photo)
                        : null,
                ]
                : null,
        ];

        if ($includeStats && $fixture->relationLoaded('playerStats')) {
            $homeClubId = (int) $fixture->home_club_id;
            $awayClubId = (int) $fixture->away_club_id;

            $formatList = static function ($rows): array {
                return $rows
                    ->map(fn ($r) => [
                        'player_name' => $r->player?->full_name,
                        'quantity' => (int) ($r->quantity ?? 1),
                    ])
                    ->values()
                    ->all();
            };

            $homeGoals = $fixture->playerStats->filter(fn ($s) => $s->stat_type === 'goal' && (int) ($s->player?->club_id ?? 0) === $homeClubId);
            $awayGoals = $fixture->playerStats->filter(fn ($s) => $s->stat_type === 'goal' && (int) ($s->player?->club_id ?? 0) === $awayClubId);
            $homeAssists = $fixture->playerStats->filter(fn ($s) => $s->stat_type === 'assist' && (int) ($s->player?->club_id ?? 0) === $homeClubId);
            $awayAssists = $fixture->playerStats->filter(fn ($s) => $s->stat_type === 'assist' && (int) ($s->player?->club_id ?? 0) === $awayClubId);

            $row['player_stats'] = [
                'home' => [
                    'goals' => $formatList($homeGoals),
                    'assists' => $formatList($homeAssists),
                ],
                'away' => [
                    'goals' => $formatList($awayGoals),
                    'assists' => $formatList($awayAssists),
                ],
            ];
        }

        return $row;
    }
}
