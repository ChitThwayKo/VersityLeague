<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\League;
use App\Models\Standing;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicStandingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $leagueId = $request->filled('league_id')
            ? $request->integer('league_id')
            : League::query()->where('status', 'active')->value('id');

        if (! $leagueId) {
            return response()->json(['standings' => [], 'league' => null]);
        }

        $league = League::query()->find($leagueId);

        $rows = Standing::query()
            ->where('league_id', $leagueId)
            ->with(['club:id,club_name,club_photo'])
            ->get()
            ->sort(function (Standing $a, Standing $b): int {
                foreach ([
                    fn (): int => $b->points <=> $a->points,
                    fn (): int => $b->goal_difference <=> $a->goal_difference,
                    fn (): int => $b->goals_for <=> $a->goals_for,
                    fn (): int => strcmp($a->club?->club_name ?? '', $b->club?->club_name ?? ''),
                ] as $cmp) {
                    $r = $cmp();
                    if ($r !== 0) {
                        return $r;
                    }
                }

                return 0;
            })
            ->values();

        $standings = $rows->map(function (Standing $row, int $index) {
            $club = $row->club;
            $photoUrl = $club && $club->club_photo
                ? PublicStorageUrl::url($club->club_photo)
                : null;

            return [
                'rank' => $index + 1,
                'club_id' => $row->club_id,
                'club_name' => $club?->club_name,
                'club_photo_url' => $photoUrl,
                'played' => $row->played,
                'won' => $row->won,
                'drawn' => $row->drawn,
                'lost' => $row->lost,
                'goals_for' => $row->goals_for,
                'goals_against' => $row->goals_against,
                'goal_difference' => $row->goal_difference,
                'points' => $row->points,
            ];
        });

        return response()->json([
            'league' => $league ? [
                'id' => $league->id,
                'name' => $league->name,
                'year' => $league->year,
                'starts_on' => $league->starts_on?->format('Y-m-d'),
                'ends_on' => $league->ends_on?->format('Y-m-d'),
            ] : null,
            'standings' => $standings,
        ]);
    }
}
