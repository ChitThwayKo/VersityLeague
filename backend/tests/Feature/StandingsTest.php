<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\Fixture;
use App\Models\MatchResult;
use App\Models\Season;
use App\Support\StandingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StandingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_standings_empty_without_active_season(): void
    {
        $this->getJson('/api/standings')->assertOk()
            ->assertJsonPath('season', null)
            ->assertJsonCount(0, 'standings');
    }

    public function test_standings_reflects_match_results_and_order(): void
    {
        $season = Season::query()->create([
            'label' => 'Test Season',
            'registration_opens_at' => now()->subWeek(),
            'registration_closes_at' => now()->addWeek(),
            'started_at' => null,
            'is_active' => true,
        ]);

        $alpha = Club::query()->create(['name' => 'Alpha FC', 'logo_path' => '', 'status' => Club::STATUS_ACTIVE]);
        $beta = Club::query()->create(['name' => 'Beta FC', 'logo_path' => '', 'status' => Club::STATUS_ACTIVE]);

        $f = Fixture::query()->create([
            'season_id' => $season->id,
            'home_club_id' => $alpha->id,
            'away_club_id' => $beta->id,
            'kickoff_at' => now()->subDay(),
            'venue_name' => 'V',
            'venue_location' => null,
            'competition_name' => 'L',
            'round_label' => null,
            'status' => Fixture::STATUS_COMPLETED,
        ]);
        MatchResult::query()->create([
            'fixture_id' => $f->id,
            'home_goals' => 3,
            'away_goals' => 0,
        ]);

        $this->getJson('/api/standings')
            ->assertOk()
            ->assertJsonPath('season.label', 'Test Season')
            ->assertJsonPath('standings.0.club_name', 'Alpha FC')
            ->assertJsonPath('standings.0.points', 3)
            ->assertJsonPath('standings.0.won', 1)
            ->assertJsonPath('standings.1.club_name', 'Beta FC')
            ->assertJsonPath('standings.1.points', 0);

        $this->assertSame(
            StandingsService::TIE_BREAKERS,
            $this->getJson('/api/standings')->json('tie_breakers')
        );
    }

    public function test_tie_on_points_gd_gf_sorts_by_club_name(): void
    {
        $season = Season::query()->create([
            'label' => 'S',
            'registration_opens_at' => now()->subWeek(),
            'registration_closes_at' => now()->addWeek(),
            'started_at' => null,
            'is_active' => true,
        ]);
        $zebra = Club::query()->create(['name' => 'Zebra', 'logo_path' => '', 'status' => Club::STATUS_ACTIVE]);
        $apple = Club::query()->create(['name' => 'Apple', 'logo_path' => '', 'status' => Club::STATUS_ACTIVE]);

        $f = Fixture::query()->create([
            'season_id' => $season->id,
            'home_club_id' => $zebra->id,
            'away_club_id' => $apple->id,
            'kickoff_at' => now()->subDay(),
            'venue_name' => 'V',
            'venue_location' => null,
            'competition_name' => 'L',
            'round_label' => null,
            'status' => Fixture::STATUS_COMPLETED,
        ]);
        MatchResult::query()->create(['fixture_id' => $f->id, 'home_goals' => 1, 'away_goals' => 1]);

        $this->getJson('/api/standings')
            ->assertOk()
            ->assertJsonPath('standings.0.club_name', 'Apple')
            ->assertJsonPath('standings.1.club_name', 'Zebra');
    }
}
