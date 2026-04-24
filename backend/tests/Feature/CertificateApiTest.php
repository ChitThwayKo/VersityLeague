<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Certificate;
use App\Models\Club;
use App\Models\League;
use App\Models\Player;
use App\Models\User;
use App\Services\CertificatePdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CertificateApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_list_certificates_and_download_pdf_other_user_forbidden(): void
    {
        $owner = User::factory()->create(['role' => UserRole::Client]);
        $other = User::factory()->create(['role' => UserRole::Client]);

        $certificate = Certificate::query()->create([
            'user_id' => $owner->id,
            'club_id' => null,
            'type' => 'participation',
            'title' => 'Certificate of participation',
            'student_staff_id' => $owner->student_staff_id,
            'participate_year_start' => 2026,
            'participate_year_end' => 2026,
            'positions_played' => 'Forward',
            'scored' => 1,
            'assisted' => 0,
            'file_path' => 'certificates/_pending.pdf',
        ]);

        app(CertificatePdfService::class)->writeToPublicDisk($certificate);

        $ownerToken = $owner->createToken('t')->plainTextToken;

        $this->withToken($ownerToken)->getJson('/api/v1/certificates')
            ->assertOk()
            ->assertJsonCount(1, 'certificates')
            ->assertJsonPath('certificates.0.recipient_name', $owner->name);

        $this->withToken($ownerToken)->get('/api/v1/certificates/'.$certificate->id.'/pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->app->make('auth')->forgetGuards();
        $otherToken = $other->createToken('t2')->plainTextToken;
        $this->withoutToken()->withToken($otherToken)->get('/api/v1/certificates/'.$certificate->id.'/pdf')
            ->assertForbidden();
    }

    public function test_client_can_list_and_download_certificate_matched_by_student_staff_id(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'student_staff_id' => '106758',
        ]);

        $legacyOwner = User::factory()->create(['role' => UserRole::Client]);

        $certificate = Certificate::query()->create([
            'user_id' => $legacyOwner->id,
            'club_id' => null,
            'type' => 'participation',
            'title' => 'Certificate of participation',
            'student_staff_id' => '106758',
            'participate_year_start' => 2026,
            'participate_year_end' => 2026,
            'positions_played' => 'Forward',
            'scored' => 1,
            'assisted' => 0,
            'file_path' => 'certificates/_pending.pdf',
        ]);

        app(CertificatePdfService::class)->writeToPublicDisk($certificate);

        $token = $client->createToken('t')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/certificates')
            ->assertOk()
            ->assertJsonCount(1, 'certificates')
            ->assertJsonPath('certificates.0.student_staff_id', '106758')
            ->assertJsonPath('certificates.0.recipient_name', $client->name);

        $this->withToken($token)->get('/api/v1/certificates/'.$certificate->id.'/pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_client_gets_player_fallback_when_certificate_is_missing(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'name' => 'Crit Thway Ko',
            'student_staff_id' => '106758',
        ]);

        $league = League::query()->create([
            'name' => 'Test League',
            'year' => 2026,
            'status' => 'active',
        ]);

        $club = Club::query()->create([
            'manager_user_id' => $client->id,
            'league_id' => $league->id,
            'club_name' => 'ZawGyi FC',
            'club_photo' => 'clubs/test.png',
            'status' => 'approved',
        ]);

        Player::query()->create([
            'club_id' => $club->id,
            'student_staff_id' => '106758',
            'full_name' => 'Crit Thway Ko',
            'position' => 'Defender',
        ]);

        $token = $client->createToken('t')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/certificates')
            ->assertOk()
            ->assertJsonCount(1, 'certificates')
            ->assertJsonPath('certificates.0.id', null)
            ->assertJsonPath('certificates.0.student_staff_id', '106758')
            ->assertJsonPath('certificates.0.recipient_name', 'Crit Thway Ko')
            ->assertJsonPath('certificates.0.positions_played', 'Defender')
            ->assertJsonPath('certificates.0.participate_year_start', '2026')
            ->assertJsonPath('certificates.0.participate_year_end', '2026');

        $this->withToken($token)->get('/api/v1/certificates/profile-pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_profile_pdf_returns_not_found_when_no_matching_player(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'student_staff_id' => 'no-player-'.uniqid('', true),
        ]);

        $token = $client->createToken('t')->plainTextToken;

        $this->withToken($token)->get('/api/v1/certificates/profile-pdf')
            ->assertNotFound();
    }
}
