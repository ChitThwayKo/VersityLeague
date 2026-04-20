<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Club;
use App\Models\League;
use App\Models\Photo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_cannot_access_admin_leagues(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $token = $client->createToken('t')->plainTextToken;

        $this->getJson('/api/v1/admin/leagues', [
            'Authorization' => 'Bearer '.$token,
        ])->assertForbidden();
    }

    public function test_admin_can_list_leagues(): void
    {
        $admin = User::factory()->admin()->create();
        League::query()->create([
            'name' => 'Premier',
            'season' => '2026',
            'status' => 'active',
        ]);

        $token = $admin->createToken('t')->plainTextToken;

        $this->getJson('/api/v1/admin/leagues', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('leagues.0.name', 'Premier');
    }

    public function test_default_admin_can_list_users_regular_admin_cannot(): void
    {
        $default = User::factory()->defaultAdmin()->create();
        $admin = User::factory()->admin()->create();

        $defToken = $default->createToken('d')->plainTextToken;
        $admToken = $admin->createToken('a')->plainTextToken;

        $this->withoutToken()->withToken($defToken)->getJson('/api/v1/admin/users')
            ->assertOk()
            ->assertJsonStructure(['users']);

        $this->app->make('auth')->forgetGuards();

        $this->withoutToken()->withToken($admToken)->getJson('/api/v1/admin/users')
            ->assertForbidden();
    }

    public function test_admin_can_approve_club_with_league(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create();
        $manager = User::factory()->create(['role' => UserRole::Client]);
        $league = League::query()->create([
            'name' => 'L',
            'season' => '2026',
            'status' => 'active',
        ]);

        $club = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => null,
            'club_name' => 'Tigers FC',
            'club_photo' => 'clubs/x.png',
            'status' => 'pending',
        ]);

        $token = $admin->createToken('t')->plainTextToken;

        $this->patchJson('/api/v1/admin/clubs/'.$club->id, [
            'status' => 'approved',
            'league_id' => $league->id,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('club.status', 'approved');
    }

    public function test_photo_store_respects_five_image_limit(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('t')->plainTextToken;

        for ($i = 0; $i < 5; $i++) {
            $this->post('/api/v1/admin/photos', [
                'image' => UploadedFile::fake()->image('p'.$i.'.jpg', 10, 10),
            ], [
                'Authorization' => 'Bearer '.$token,
                'Accept' => 'application/json',
            ])->assertCreated();
        }

        $this->post('/api/v1/admin/photos', [
            'image' => UploadedFile::fake()->image('extra.jpg', 10, 10),
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertStatus(422);

        $this->assertSame(5, Photo::query()->count());
    }
}
