<?php

namespace App\Support;

use App\Models\Season;
use Illuminate\Support\Carbon;

class SeasonGating
{
    /**
     * @return array{active_season: ?array<string, mixed>, gating: array<string, mixed>}
     */
    public static function payload(?Season $season, ?Carbon $now = null): array
    {
        $now ??= now();

        if ($season === null) {
            return [
                'active_season' => null,
                'gating' => [
                    'league_has_started' => false,
                    'registration_window_open' => false,
                    'registration_allowed' => false,
                    'phase' => 'no_active_season',
                ],
            ];
        }

        $leagueStarted = $season->started_at !== null && $season->started_at->lte($now);
        $withinWindow = $now->between($season->registration_opens_at, $season->registration_closes_at);
        $registrationAllowed = ! $leagueStarted && $withinWindow;

        $phase = match (true) {
            $leagueStarted => 'league_started',
            $registrationAllowed => 'registration_open',
            $now->lt($season->registration_opens_at) => 'before_registration_window',
            default => 'registration_window_closed',
        };

        return [
            'active_season' => self::seasonToArray($season),
            'gating' => [
                'league_has_started' => $leagueStarted,
                'registration_window_open' => $withinWindow,
                'registration_allowed' => $registrationAllowed,
                'phase' => $phase,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function seasonToArray(Season $season): array
    {
        return [
            'id' => $season->id,
            'label' => $season->label,
            'registration_opens_at' => $season->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $season->registration_closes_at->toIso8601String(),
            'started_at' => $season->started_at?->toIso8601String(),
            'is_active' => (bool) $season->is_active,
        ];
    }
}
