<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\League;
use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicStatsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_stats_home_returns_zero_without_players(): void
    {
        $this->getJson('/api/v1/stats/home')
            ->assertOk()
            ->assertJsonPath('total_players', 0);
    }

    public function test_stats_home_counts_distinct_student_staff_ids_all_seasons(): void
    {
        $manager = User::factory()->create();

        $league2026 = League::query()->create([
            'name' => 'League A',
            'year' => 2026,
            'status' => 'active',
        ]);
        $league2027 = League::query()->create([
            'name' => 'League B',
            'year' => 2027,
            'status' => 'active',
        ]);

        $clubA = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league2026->id,
            'club_name' => 'Club Alpha',
            'club_photo' => 'clubs/a.png',
            'status' => 'approved',
        ]);
        $clubB = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league2027->id,
            'club_name' => 'Club Beta',
            'club_photo' => 'clubs/b.png',
            'status' => 'approved',
        ]);

        Player::query()->create([
            'club_id' => $clubA->id,
            'student_staff_id' => '100001',
            'full_name' => 'Player One',
            'position' => 'Forward',
        ]);
        Player::query()->create([
            'club_id' => $clubB->id,
            'student_staff_id' => '100002',
            'full_name' => 'Player Two',
            'position' => 'Defender',
        ]);

        $this->getJson('/api/v1/stats/home')
            ->assertOk()
            ->assertJsonPath('total_players', 2);
    }
}
