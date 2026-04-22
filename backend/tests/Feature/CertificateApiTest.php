<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Certificate;
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
            ->assertJsonCount(1, 'certificates');

        $this->withToken($ownerToken)->get('/api/v1/certificates/'.$certificate->id.'/pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->app->make('auth')->forgetGuards();
        $otherToken = $other->createToken('t2')->plainTextToken;
        $this->withoutToken()->withToken($otherToken)->get('/api/v1/certificates/'.$certificate->id.'/pdf')
            ->assertForbidden();
    }
}
