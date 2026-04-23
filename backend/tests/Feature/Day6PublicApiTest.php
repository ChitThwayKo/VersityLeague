<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\Fixture;
use App\Models\League;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Day6PublicApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_fixture_show_returns_match_payload(): void
    {
        $league = League::query()->create([
            'name' => 'L',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);

        $manager = User::factory()->create();

        $home = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league->id,
            'club_name' => 'Tigers',
            'club_photo' => 'clubs/t.png',
            'status' => 'approved',
        ]);

        $away = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league->id,
            'club_name' => 'Lions',
            'club_photo' => 'clubs/l.png',
            'status' => 'approved',
        ]);

        $fixture = Fixture::query()->create([
            'league_id' => $league->id,
            'home_club_id' => $home->id,
            'away_club_id' => $away->id,
            'match_date' => '2026-05-01',
            'match_time' => '18:30:00',
            'venue' => 'Main pitch',
            'home_score' => null,
            'away_score' => null,
            'status' => 'upcoming',
        ]);

        $this->getJson('/api/v1/fixtures/'.$fixture->id)
            ->assertOk()
            ->assertJsonPath('fixture.venue', 'Main pitch')
            ->assertJsonPath('fixture.league.name', 'L')
            ->assertJsonPath('fixture.home_club.club_name', 'Tigers');
    }
}
