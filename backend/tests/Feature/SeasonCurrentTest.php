<?php

namespace Tests\Feature;

use App\Models\Season;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SeasonCurrentTest extends TestCase
{
    use RefreshDatabase;

    public function test_current_without_active_season(): void
    {
        $response = $this->getJson('/api/seasons/current');

        $response->assertOk()
            ->assertJsonPath('active_season', null)
            ->assertJsonPath('gating.phase', 'no_active_season')
            ->assertJsonPath('gating.registration_allowed', false);
    }

    public function test_current_registration_open_when_window_active_and_not_started(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        Season::query()->create([
            'label' => 'Test',
            'registration_opens_at' => '2026-06-01 00:00:00',
            'registration_closes_at' => '2026-06-30 23:59:59',
            'started_at' => null,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/seasons/current');

        $response->assertOk()
            ->assertJsonPath('gating.phase', 'registration_open')
            ->assertJsonPath('gating.registration_allowed', true)
            ->assertJsonPath('gating.league_has_started', false);

        Carbon::setTestNow();
    }

    public function test_current_league_started_blocks_registration(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-15 12:00:00'));

        Season::query()->create([
            'label' => 'Test',
            'registration_opens_at' => '2026-05-01 00:00:00',
            'registration_closes_at' => '2026-06-30 23:59:59',
            'started_at' => '2026-06-10 00:00:00',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/seasons/current');

        $response->assertOk()
            ->assertJsonPath('gating.phase', 'league_started')
            ->assertJsonPath('gating.registration_allowed', false)
            ->assertJsonPath('gating.league_has_started', true);

        Carbon::setTestNow();
    }
}
