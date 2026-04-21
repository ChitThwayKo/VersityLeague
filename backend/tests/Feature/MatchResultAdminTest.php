<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\Fixture;
use App\Models\Season;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MatchResultAdminTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        User::factory()->create([
            'username' => 'admres',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_ADMIN,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'username' => 'admres',
            'password' => 'Password1',
            'intent' => 'admin',
            'recaptcha_token' => 'test',
        ]);

        return ['Authorization' => 'Bearer '.$login->json('token')];
    }

    public function test_guest_cannot_save_result(): void
    {
        $fixture = $this->makeFixture();

        $this->putJson('/api/admin/fixtures/'.$fixture->id.'/result', [
            'home_goals' => 1,
            'away_goals' => 1,
        ])->assertUnauthorized();
    }

    public function test_admin_can_upsert_and_clear_result(): void
    {
        $headers = $this->adminHeaders();
        $fixture = $this->makeFixture();

        $this->putJson('/api/admin/fixtures/'.$fixture->id.'/result', [
            'home_goals' => 2,
            'away_goals' => 0,
        ], $headers)->assertOk()
            ->assertJsonPath('fixture.result.home_goals', 2)
            ->assertJsonPath('fixture.status', 'completed');

        $this->assertDatabaseHas('match_results', [
            'fixture_id' => $fixture->id,
            'home_goals' => 2,
            'away_goals' => 0,
        ]);

        $this->deleteJson('/api/admin/fixtures/'.$fixture->id.'/result', [], $headers)->assertOk()
            ->assertJsonPath('fixture.result', null)
            ->assertJsonPath('fixture.status', 'scheduled');

        $this->assertDatabaseMissing('match_results', ['fixture_id' => $fixture->id]);
    }

    private function makeFixture(): Fixture
    {
        $season = Season::query()->create([
            'label' => 'S',
            'registration_opens_at' => now()->subWeek(),
            'registration_closes_at' => now()->addWeek(),
            'started_at' => null,
            'is_active' => true,
        ]);
        $h = Club::query()->create(['name' => 'H', 'logo_path' => '', 'status' => Club::STATUS_ACTIVE]);
        $a = Club::query()->create(['name' => 'A', 'logo_path' => '', 'status' => Club::STATUS_ACTIVE]);

        return Fixture::query()->create([
            'season_id' => $season->id,
            'home_club_id' => $h->id,
            'away_club_id' => $a->id,
            'kickoff_at' => now()->addDay(),
            'venue_name' => 'V',
            'venue_location' => null,
            'competition_name' => 'L',
            'round_label' => null,
            'status' => Fixture::STATUS_SCHEDULED,
        ]);
    }
}
