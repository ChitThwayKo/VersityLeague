<?php

namespace Database\Seeders;

use App\Models\Club;
use App\Models\Fixture;
use App\Models\MatchResult;
use App\Models\Season;
use Illuminate\Database\Seeder;

class DemoFixtureSeeder extends Seeder
{
    public function run(): void
    {
        if (Fixture::query()->exists()) {
            return;
        }

        $season = Season::query()->where('is_active', true)->first();
        if (! $season) {
            return;
        }

        $clubs = Club::query()
            ->where('status', Club::STATUS_ACTIVE)
            ->orderBy('id')
            ->take(2)
            ->get();

        if ($clubs->count() < 2) {
            return;
        }

        [$home, $away] = [$clubs[0], $clubs[1]];

        $f1 = Fixture::query()->create([
            'season_id' => $season->id,
            'match_number' => '1',
            'home_club_id' => $home->id,
            'away_club_id' => $away->id,
            'kickoff_at' => now()->subDays(2)->setTime(15, 0),
            'venue_name' => 'University Main Pitch',
            'venue_location' => 'North campus',
            'competition_name' => $season->label,
            'round_label' => 'Matchweek 1',
            'status' => Fixture::STATUS_COMPLETED,
        ]);
        MatchResult::query()->create([
            'fixture_id' => $f1->id,
            'home_goals' => 2,
            'away_goals' => 1,
        ]);

        Fixture::query()->create([
            'season_id' => $season->id,
            'match_number' => '2',
            'home_club_id' => $away->id,
            'away_club_id' => $home->id,
            'kickoff_at' => now()->addDays(5)->setTime(12, 30),
            'venue_name' => 'Sports Complex Field B',
            'venue_location' => null,
            'competition_name' => $season->label,
            'round_label' => 'Matchweek 2',
            'status' => Fixture::STATUS_SCHEDULED,
        ]);
    }
}
