<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\ClubMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ClubAdminTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        User::factory()->create([
            'username' => 'admclub',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_ADMIN,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'username' => 'admclub',
            'password' => 'Password1',
            'intent' => 'admin',
            'recaptcha_token' => 'test',
        ]);

        return ['Authorization' => 'Bearer '.$login->json('token')];
    }

    public function test_admin_can_create_club_with_logo(): void
    {
        Storage::fake('public');
        $headers = $this->adminHeaders();

        $file = UploadedFile::fake()->image('logo.png', 120, 120);

        $response = $this->post('/api/admin/clubs', [
            'name' => 'Photo Club',
            'founded_year' => 2021,
            'status' => Club::STATUS_ACTIVE,
            'logo' => $file,
        ], $headers);

        $response->assertCreated();
        $path = Club::query()->first()->logo_path;
        $this->assertNotSame('', $path);
        Storage::disk('public')->assertExists($path);
    }

    public function test_admin_can_add_player_member(): void
    {
        $headers = $this->adminHeaders();
        $club = Club::query()->create([
            'name' => 'Member Club',
            'logo_path' => '',
            'status' => Club::STATUS_ACTIVE,
        ]);

        $response = $this->post('/api/admin/clubs/'.$club->id.'/members', [
            'member_type' => ClubMember::TYPE_PLAYER,
            'name' => 'Striker',
            'jersey_number' => 11,
            'position' => 'Forward',
            'sort_order' => 1,
        ], $headers);

        $response->assertCreated()
            ->assertJsonPath('member.name', 'Striker');

        $this->assertDatabaseHas('club_members', [
            'club_id' => $club->id,
            'name' => 'Striker',
            'jersey_number' => 11,
        ]);
    }

    public function test_admin_can_update_member(): void
    {
        $headers = $this->adminHeaders();
        $club = Club::query()->create([
            'name' => 'Update Club',
            'logo_path' => '',
            'status' => Club::STATUS_ACTIVE,
        ]);
        $member = $club->members()->create([
            'member_type' => ClubMember::TYPE_PLAYER,
            'name' => 'Old Name',
            'photo_path' => '',
            'jersey_number' => 9,
            'position' => 'Forward',
            'sort_order' => 0,
        ]);

        $response = $this->putJson('/api/admin/clubs/'.$club->id.'/members/'.$member->id, [
            'member_type' => ClubMember::TYPE_PLAYER,
            'name' => 'New Name',
            'jersey_number' => 5,
            'position' => 'Defender',
            'sort_order' => 2,
        ], $headers);

        $response->assertOk()
            ->assertJsonPath('member.name', 'New Name')
            ->assertJsonPath('member.jersey_number', 5);

        $this->assertDatabaseHas('club_members', [
            'id' => $member->id,
            'name' => 'New Name',
            'jersey_number' => 5,
            'position' => 'Defender',
        ]);
    }

    public function test_delete_club_removes_members(): void
    {
        $headers = $this->adminHeaders();
        $club = Club::query()->create([
            'name' => 'Delete Me',
            'logo_path' => '',
            'status' => Club::STATUS_ACTIVE,
        ]);
        $club->members()->create([
            'member_type' => ClubMember::TYPE_COACH,
            'name' => 'C',
            'photo_path' => '',
            'sort_order' => 0,
        ]);

        $this->deleteJson('/api/admin/clubs/'.$club->id, [], $headers)->assertOk();

        $this->assertDatabaseMissing('clubs', ['id' => $club->id]);
        $this->assertDatabaseCount('club_members', 0);
    }
}
