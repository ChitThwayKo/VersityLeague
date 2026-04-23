<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\Fixture;
use App\Models\League;
use App\Models\Standing;
use App\Models\User;
use App\Services\StandingsRecalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StandingsRecalculationTest extends TestCase
{
    use RefreshDatabase;

    public function test_finished_fixtures_produce_points_and_admin_fixture_triggers_recalc(): void
    {
        $league = League::query()->create([
            'name' => 'Test League',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);

        $manager = User::factory()->create();

        $home = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league->id,
            'club_name' => 'Home FC',
            'club_photo' => 'clubs/h.png',
            'status' => 'approved',
        ]);

        $away = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league->id,
            'club_name' => 'Away FC',
            'club_photo' => 'clubs/a.png',
            'status' => 'approved',
        ]);

        Fixture::query()->create([
            'league_id' => $league->id,
            'home_club_id' => $home->id,
            'away_club_id' => $away->id,
            'match_date' => now()->toDateString(),
            'match_time' => '15:00:00',
            'venue' => 'Stadium',
            'home_score' => 2,
            'away_score' => 1,
            'status' => 'finished',
        ]);

        app(StandingsRecalculationService::class)->recalculateForLeague($league->id);

        $homeStanding = Standing::query()->where('club_id', $home->id)->first();
        $awayStanding = Standing::query()->where('club_id', $away->id)->first();

        $this->assertSame(3, $homeStanding->points);
        $this->assertSame(0, $awayStanding->points);
        $this->assertSame(1, $homeStanding->won);
        $this->assertSame(1, $awayStanding->lost);
    }
}
