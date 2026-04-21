<?php

namespace App\Support;

use App\Models\Club;
use App\Models\MatchResult;
use App\Models\Season;
use Illuminate\Support\Str;

/**
 * League table for the active season, driven only by persisted {@see MatchResult} rows.
 *
 * Tie-breakers after points (3 / 1 / 0) and goal difference (per PROJECT_SPEC §5.1):
 * 1. Higher goals for (GF)
 * 2. Alphabetical by club name (deterministic; client did not mandate head-to-head in v1)
 */
class StandingsService
{
    public const TIE_BREAKERS = [
        'points_desc',
        'goal_difference_desc',
        'goals_for_desc',
        'club_name_asc',
    ];

    /**
     * @return array{season: array<string, mixed>|null, tie_breakers: list<string>, standings: list<array<string, mixed>>}
     */
    public function forActiveSeason(): array
    {
        $season = Season::query()->where('is_active', true)->first();

        if (! $season) {
            return [
                'season' => null,
                'tie_breakers' => self::TIE_BREAKERS,
                'standings' => [],
            ];
        }

        return [
            'season' => [
                'id' => $season->id,
                'label' => $season->label,
            ],
            'tie_breakers' => self::TIE_BREAKERS,
            'standings' => $this->computeRows($season),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function computeRows(Season $season): array
    {
        /** @var Collection<int, Club> $clubs */
        $clubs = Club::query()
            ->where('status', Club::STATUS_ACTIVE)
            ->orderBy('name')
            ->get();

        $byId = [];
        foreach ($clubs as $club) {
            $byId[$club->id] = [
                'club' => $club,
                'played' => 0,
                'won' => 0,
                'drawn' => 0,
                'lost' => 0,
                'gf' => 0,
                'ga' => 0,
                'gd' => 0,
                'points' => 0,
            ];
        }

        $results = MatchResult::query()
            ->whereHas('fixture', fn ($q) => $q->where('season_id', $season->id))
            ->with(['fixture'])
            ->get();

        foreach ($results as $r) {
            $f = $r->fixture;
            if ($f === null) {
                continue;
            }
            $hid = $f->home_club_id;
            $aid = $f->away_club_id;
            if (! isset($byId[$hid], $byId[$aid])) {
                continue;
            }
            $hg = (int) $r->home_goals;
            $ag = (int) $r->away_goals;

            $this->applyOneSide($byId[$hid], $hg, $ag);
            $this->applyOneSide($byId[$aid], $ag, $hg);
        }

        $rows = collect($byId)->map(function (array $row) {
            $club = $row['club'];
            $gf = $row['gf'];
            $ga = $row['ga'];

            return [
                'club_id' => $club->id,
                'club_name' => $club->name,
                'club_logo_url' => $club->logoPublicUrl(),
                'played' => $row['played'],
                'won' => $row['won'],
                'drawn' => $row['drawn'],
                'lost' => $row['lost'],
                'gf' => $gf,
                'ga' => $ga,
                'gd' => $gf - $ga,
                'points' => $row['points'],
                '_sort_name' => Str::lower($club->name),
            ];
        })->values();

        $sorted = $rows->sort(function (array $a, array $b) {
            if ($a['points'] !== $b['points']) {
                return $b['points'] <=> $a['points'];
            }
            if ($a['gd'] !== $b['gd']) {
                return $b['gd'] <=> $a['gd'];
            }
            if ($a['gf'] !== $b['gf']) {
                return $b['gf'] <=> $a['gf'];
            }

            return strcmp($a['_sort_name'], $b['_sort_name']);
        })->values();

        $out = [];
        $rank = 1;
        foreach ($sorted as $i => $row) {
            if ($i > 0 && ! $this->sameStanding($sorted[$i - 1], $row)) {
                $rank = $i + 1;
            }
            unset($row['_sort_name']);
            $row['position'] = $rank;
            $out[] = $row;
        }

        return $out;
    }

    /**
     * @param  array{points: int, gd: int, gf: int, _sort_name: string}  $a
     * @param  array{points: int, gd: int, gf: int, _sort_name: string}  $b
     */
    private function sameStanding(array $a, array $b): bool
    {
        return $a['points'] === $b['points']
            && $a['gd'] === $b['gd']
            && $a['gf'] === $b['gf']
            && $a['_sort_name'] === $b['_sort_name'];
    }

    /**
     * @param  array{played: int, won: int, drawn: int, lost: int, gf: int, ga: int, points: int}  $side
     */
    private function applyOneSide(array &$side, int $goalsFor, int $goalsAgainst): void
    {
        $side['played']++;
        $side['gf'] += $goalsFor;
        $side['ga'] += $goalsAgainst;
        if ($goalsFor > $goalsAgainst) {
            $side['won']++;
            $side['points'] += 3;
        } elseif ($goalsFor === $goalsAgainst) {
            $side['drawn']++;
            $side['points'] += 1;
        } else {
            $side['lost']++;
        }
    }
}
