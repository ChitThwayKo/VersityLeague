<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Club;
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

        $user = User::factory()->create([
            'role' => UserRole::Client,
        ]);

        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/club-registrations', [
            'club_name' => 'Knights United FC',
            'club_photo' => UploadedFile::fake()->image('club.jpg', 400, 400),
            'player_full_name' => 'Alex Morgan',
            'player_student_staff_id' => 'PLAYER-STU-9001',
            'jersey_number' => 10,
            'position' => 'Forward',
            'player_photo' => UploadedFile::fake()->image('player.jpg', 200, 200),
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
            'jersey_number' => 10,
        ]);

        $club = Club::query()->where('club_name', 'Knights United FC')->first();
        $this->assertNotNull($club);
        Storage::disk('public')->assertExists($club->club_photo);
    }

    public function test_admin_cannot_submit_club_registration(): void
    {
        Storage::fake('public');

        $user = User::factory()->admin()->create();
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/club-registrations', [
            'club_name' => 'Should Fail FC',
            'club_photo' => UploadedFile::fake()->image('club.jpg'),
            'player_full_name' => 'Test',
            'player_student_staff_id' => 'STU-8001',
            'position' => 'Coach',
        ], ['Accept' => 'application/json']);

        $response->assertForbidden();
    }

    public function test_guest_cannot_submit_club_registration(): void
    {
        $response = $this->post('/api/v1/club-registrations', [
            'club_name' => 'Guest FC',
            'club_photo' => UploadedFile::fake()->image('club.jpg'),
            'player_full_name' => 'Test',
            'player_student_staff_id' => 'STU-8002',
            'position' => 'Coach',
        ], ['Accept' => 'application/json']);

        $response->assertUnauthorized();
    }

    public function test_validation_requires_club_photo(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => UserRole::Client]);
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/club-registrations', [
            'club_name' => 'No Photo FC',
            'player_full_name' => 'Test',
            'player_student_staff_id' => 'STU-8003',
            'position' => 'Coach',
        ], ['Accept' => 'application/json']);

        $response->assertUnprocessable();
    }
}
