<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\ClubMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClubPublicTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_lists_only_active_clubs(): void
    {
        Club::query()->create([
            'name' => 'Active FC',
            'logo_path' => '',
            'status' => Club::STATUS_ACTIVE,
        ]);
        Club::query()->create([
            'name' => 'Old FC',
            'logo_path' => '',
            'status' => Club::STATUS_ARCHIVED,
        ]);

        $response = $this->getJson('/api/clubs');

        $response->assertOk()
            ->assertJsonCount(1, 'clubs')
            ->assertJsonPath('clubs.0.name', 'Active FC');
    }

    public function test_show_returns_coaches_and_players(): void
    {
        $club = Club::query()->create([
            'name' => 'Test United',
            'logo_path' => '',
            'founded_year' => 2019,
            'motto' => 'Play fair',
            'status' => Club::STATUS_ACTIVE,
        ]);
        $club->members()->create([
            'member_type' => ClubMember::TYPE_COACH,
            'name' => 'Coach Pat',
            'photo_path' => '',
            'sort_order' => 0,
        ]);
        $club->members()->create([
            'member_type' => ClubMember::TYPE_PLAYER,
            'name' => 'Player One',
            'photo_path' => '',
            'jersey_number' => 9,
            'position' => 'Striker',
            'sort_order' => 1,
        ]);

        $response = $this->getJson('/api/clubs/'.$club->id);

        $response->assertOk()
            ->assertJsonPath('club.name', 'Test United')
            ->assertJsonPath('coaches.0.name', 'Coach Pat')
            ->assertJsonPath('players.0.jersey_number', 9);
    }

    public function test_archived_club_returns_404_on_public_show(): void
    {
        $club = Club::query()->create([
            'name' => 'Gone',
            'logo_path' => '',
            'status' => Club::STATUS_ARCHIVED,
        ]);

        $this->getJson('/api/clubs/'.$club->id)->assertNotFound();
    }
}
