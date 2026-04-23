<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Certificate;
use App\Models\Club;
use App\Models\Fixture;
use App\Models\League;
use App\Models\Player;
use App\Models\Photo;
use App\Models\User;
use App\Services\CertificatePdfService;
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
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
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
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
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

        $this->assertDatabaseHas('standings', [
            'league_id' => $league->id,
            'club_id' => $club->id,
            'played' => 0,
            'won' => 0,
            'drawn' => 0,
            'lost' => 0,
            'points' => 0,
        ]);
    }

    public function test_admin_can_update_club_name_and_delete_club(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create();
        $manager = User::factory()->create(['role' => UserRole::Client]);
        $league = League::query()->create([
            'name' => 'L2',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);
        $club = Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league->id,
            'club_name' => 'Original FC',
            'club_photo' => 'clubs/o.png',
            'status' => 'approved',
        ]);
        $token = $admin->createToken('t')->plainTextToken;

        $this->patchJson('/api/v1/admin/clubs/'.$club->id, [
            'club_name' => 'Renamed FC',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('club.club_name', 'Renamed FC');

        $this->deleteJson('/api/v1/admin/clubs/'.$club->id, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseMissing('clubs', ['id' => $club->id]);
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

    public function test_admin_can_read_standings_via_admin_route(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('t')->plainTextToken;

        $this->getJson('/api/v1/admin/standings', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonStructure(['standings', 'league']);
    }

    public function test_admin_can_list_and_download_certificates(): void
    {
        $admin = User::factory()->admin()->create();
        $owner = User::factory()->create(['role' => UserRole::Client]);
        $certificate = Certificate::query()->create([
            'user_id' => $owner->id,
            'club_id' => null,
            'type' => 'participation',
            'title' => 'Test cert',
            'student_staff_id' => $owner->student_staff_id,
            'participate_year_start' => 2026,
            'participate_year_end' => 2026,
            'positions_played' => 'Mid',
            'scored' => 0,
            'assisted' => 0,
            'file_path' => 'certificates/_t.pdf',
        ]);
        app(CertificatePdfService::class)->writeToPublicDisk($certificate);

        $token = $admin->createToken('t')->plainTextToken;

        $this->getJson('/api/v1/admin/certificates', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('certificates.0.title', 'Test cert');

        $this->get('/api/v1/admin/certificates/'.$certificate->id.'/pdf', [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/pdf',
        ])->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_client_cannot_access_admin_certificates(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $token = $client->createToken('c')->plainTextToken;

        $this->getJson('/api/v1/admin/certificates', [
            'Authorization' => 'Bearer '.$token,
        ])->assertForbidden();
    }

    public function test_admin_cannot_delete_league_with_linked_club(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->create(['role' => UserRole::Client]);
        $league = League::query()->create([
            'name' => 'L',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);
        Club::query()->create([
            'manager_user_id' => $manager->id,
            'league_id' => $league->id,
            'club_name' => 'X',
            'club_photo' => 'clubs/x.png',
            'status' => 'approved',
        ]);
        $token = $admin->createToken('t')->plainTextToken;

        $this->deleteJson('/api/v1/admin/leagues/'.$league->id, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);

        $this->assertDatabaseHas('leagues', ['id' => $league->id]);
    }

    public function test_default_admin_can_update_and_delete_users(): void
    {
        $default = User::factory()->defaultAdmin()->create();
        $target = User::factory()->create(['role' => UserRole::Client]);
        $token = $default->createToken('d')->plainTextToken;

        $this->patchJson('/api/v1/admin/users/'.$target->id, [
            'name' => 'Updated Client',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('user.name', 'Updated Client');

        $this->deleteJson('/api/v1/admin/users/'.$target->id, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_fixture_player_stats_crud_for_admin(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('t')->plainTextToken;

        $league = League::query()->create([
            'name' => 'L',
            'year' => '2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'active',
        ]);
        $managerA = User::factory()->create(['role' => UserRole::Client]);
        $managerB = User::factory()->create(['role' => UserRole::Client]);
        $clubA = Club::query()->create([
            'manager_user_id' => $managerA->id,
            'league_id' => $league->id,
            'club_name' => 'Club A',
            'club_photo' => 'clubs/a.png',
            'status' => 'approved',
        ]);
        $clubB = Club::query()->create([
            'manager_user_id' => $managerB->id,
            'league_id' => $league->id,
            'club_name' => 'Club B',
            'club_photo' => 'clubs/b.png',
            'status' => 'approved',
        ]);
        $fixture = Fixture::query()->create([
            'league_id' => $league->id,
            'home_club_id' => $clubA->id,
            'away_club_id' => $clubB->id,
            'match_date' => '2026-04-20',
            'match_time' => '10:00:00',
            'venue' => 'Ground',
            'status' => 'upcoming',
        ]);
        $player = Player::query()->create([
            'club_id' => $clubA->id,
            'student_staff_id' => 'P-001',
            'full_name' => 'Player A',
            'position' => 'Mid',
        ]);

        $create = $this->postJson('/api/v1/admin/fixtures/'.$fixture->id.'/player-stats', [
            'player_id' => $player->id,
            'stat_type' => 'goal',
            'quantity' => 2,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertCreated()->json('stat.id');

        $this->getJson('/api/v1/admin/fixtures/'.$fixture->id.'/player-stats', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('stats.0.stat_type', 'goal')
            ->assertJsonPath('stats.0.quantity', 2);

        $this->patchJson('/api/v1/admin/fixture-player-stats/'.$create, [
            'quantity' => 3,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('stat.quantity', 3);

        $this->deleteJson('/api/v1/admin/fixture-player-stats/'.$create, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseMissing('fixture_player_stats', ['id' => $create]);
    }

}
