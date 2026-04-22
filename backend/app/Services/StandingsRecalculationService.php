<?php

namespace App\Services;

use App\Models\Club;
use App\Models\Fixture;
use App\Models\Standing;
use Illuminate\Support\Facades\DB;

class StandingsRecalculationService
{
    /**
     * Rebuild standings for one league from finished fixtures (3 pts win, 1 draw, 0 loss).
     */
    public function recalculateForLeague(int $leagueId): void
    {
        $clubIds = Club::query()
            ->where('league_id', $leagueId)
            ->where('status', 'approved')
            ->pluck('id')
            ->all();

        if ($clubIds === []) {
            Standing::query()->where('league_id', $leagueId)->delete();

            return;
        }

        $stats = [];
        foreach ($clubIds as $cid) {
            $stats[(int) $cid] = [
                'played' => 0,
                'won' => 0,
                'drawn' => 0,
                'lost' => 0,
                'goals_for' => 0,
                'goals_against' => 0,
            ];
        }

        $fixtures = Fixture::query()
            ->where('league_id', $leagueId)
            ->where('status', 'finished')
            ->whereNotNull('home_score')
            ->whereNotNull('away_score')
            ->get();

        foreach ($fixtures as $fixture) {
            $homeId = (int) $fixture->home_club_id;
            $awayId = (int) $fixture->away_club_id;
            if (! isset($stats[$homeId]) || ! isset($stats[$awayId])) {
                continue;
            }

            $hs = (int) $fixture->home_score;
            $as = (int) $fixture->away_score;

            $stats[$homeId]['played']++;
            $stats[$awayId]['played']++;
            $stats[$homeId]['goals_for'] += $hs;
            $stats[$homeId]['goals_against'] += $as;
            $stats[$awayId]['goals_for'] += $as;
            $stats[$awayId]['goals_against'] += $hs;

            if ($hs > $as) {
                $stats[$homeId]['won']++;
                $stats[$awayId]['lost']++;
            } elseif ($hs < $as) {
                $stats[$homeId]['lost']++;
                $stats[$awayId]['won']++;
            } else {
                $stats[$homeId]['drawn']++;
                $stats[$awayId]['drawn']++;
            }
        }

        DB::transaction(function () use ($leagueId, $clubIds, $stats): void {
            Standing::query()->where('league_id', $leagueId)->whereNotIn('club_id', $clubIds)->delete();

            foreach ($clubIds as $clubId) {
                $s = $stats[$clubId];
                $gd = $s['goals_for'] - $s['goals_against'];
                $pts = $s['won'] * 3 + $s['drawn'];

                Standing::query()->updateOrCreate(
                    [
                        'league_id' => $leagueId,
                        'club_id' => $clubId,
                    ],
                    [
                        'played' => $s['played'],
                        'won' => $s['won'],
                        'drawn' => $s['drawn'],
                        'lost' => $s['lost'],
                        'goals_for' => $s['goals_for'],
                        'goals_against' => $s['goals_against'],
                        'goal_difference' => $gd,
                        'points' => $pts,
                    ]
                );
            }
        });
    }
}
