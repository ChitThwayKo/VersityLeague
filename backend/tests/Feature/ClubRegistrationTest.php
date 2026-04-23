<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Club;
use App\Models\League;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClubRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_submit_club_registration_with_uploads(): void
    {
        Storage::fake('public');
        $league = League::query()->create([
            'name' => 'Registration Season',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);

        $user = User::factory()->create([
            'role' => UserRole::Client,
        ]);

        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/club-registrations', [
            'league_id' => $league->id,
            'club_name' => 'Knights United FC',
            'club_photo' => UploadedFile::fake()->image('club.jpg', 400, 400),
            'players' => [
                [
                    'full_name' => 'Alex Morgan',
                    'student_staff_id' => 'PLAYER-STU-9001',
                    'jersey_number' => 10,
                    'position' => 'Forward',
                    'role' => 'Captain',
                    'player_photo' => UploadedFile::fake()->image('player.jpg', 200, 200),
                ],
                [
                    'full_name' => 'Taylor Reed',
                    'student_staff_id' => 'PLAYER-STU-9002',
                    'jersey_number' => 1,
                    'position' => null,
                    'role' => 'Head Coach',
                ],
            ],
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('club.status', 'pending')
            ->assertJsonPath('club.club_name', 'Knights United FC');

        $this->assertDatabaseHas('clubs', [
            'manager_user_id' => $user->id,
            'club_name' => 'Knights United FC',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('players', [
            'student_staff_id' => 'PLAYER-STU-9001',
            'full_name' => 'Alex Morgan',
            'position' => 'Forward',
            'role' => 'Captain',
            'jersey_number' => 10,
        ]);

        $this->assertDatabaseHas('players', [
            'student_staff_id' => 'PLAYER-STU-9002',
            'full_name' => 'Taylor Reed',
            'position' => null,
            'role' => 'Head Coach',
            'jersey_number' => 1,
        ]);

        $club = Club::query()->where('club_name', 'Knights United FC')->first();
        $this->assertNotNull($club);
        Storage::disk('public')->assertExists($club->club_photo);
    }

    public function test_admin_cannot_submit_club_registration(): void
    {
        Storage::fake('public');
        $league = League::query()->create([
            'name' => 'Registration Season',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);

        $user = User::factory()->admin()->create();
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/club-registrations', [
            'league_id' => $league->id,
            'club_name' => 'Should Fail FC',
            'club_photo' => UploadedFile::fake()->image('club.jpg'),
            'players' => [
                [
                    'full_name' => 'Test',
                    'student_staff_id' => 'STU-8001',
                    'position' => 'Coach',
                    'role' => 'Head Coach',
                ],
                [
                    'full_name' => 'Test 2',
                    'student_staff_id' => 'STU-80011',
                    'position' => 'Coach',
                    'role' => 'Captain',
                ],
            ],
        ], ['Accept' => 'application/json']);

        $response->assertForbidden();
    }

    public function test_guest_cannot_submit_club_registration(): void
    {
        $league = League::query()->create([
            'name' => 'Registration Season',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);

        $response = $this->post('/api/v1/club-registrations', [
            'league_id' => $league->id,
            'club_name' => 'Guest FC',
            'club_photo' => UploadedFile::fake()->image('club.jpg'),
            'players' => [
                [
                    'full_name' => 'Test',
                    'student_staff_id' => 'STU-8002',
                    'position' => 'Coach',
                    'role' => 'Head Coach',
                ],
                [
                    'full_name' => 'Test 2',
                    'student_staff_id' => 'STU-80022',
                    'position' => 'Coach',
                    'role' => 'Captain',
                ],
            ],
        ], ['Accept' => 'application/json']);

        $response->assertUnauthorized();
    }

    public function test_validation_requires_club_photo(): void
    {
        Storage::fake('public');
        $league = League::query()->create([
            'name' => 'Registration Season',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);

        $user = User::factory()->create(['role' => UserRole::Client]);
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/club-registrations', [
            'league_id' => $league->id,
            'club_name' => 'No Photo FC',
            'players' => [
                [
                    'full_name' => 'Test',
                    'student_staff_id' => 'STU-8003',
                    'position' => 'Coach',
                    'role' => 'Head Coach',
                ],
                [
                    'full_name' => 'Test 2',
                    'student_staff_id' => 'STU-80033',
                    'position' => 'Coach',
                    'role' => 'Captain',
                ],
            ],
        ], ['Accept' => 'application/json']);

        $response->assertUnprocessable();
    }
}
