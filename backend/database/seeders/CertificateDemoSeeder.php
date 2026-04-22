<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Certificate;
use App\Models\User;
use App\Services\CertificatePdfService;
use Illuminate\Database\Seeder;

class CertificateDemoSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->where('role', UserRole::Client)->orderBy('id')->first()
            ?? User::factory()->create([
                'role' => UserRole::Client,
                'email' => 'demo-client@versity-league.local',
                'student_staff_id' => 'DEMO-CLIENT-001',
            ]);

        if (Certificate::query()->where('user_id', $user->id)->exists()) {
            return;
        }

        $certificate = Certificate::query()->create([
            'user_id' => $user->id,
            'club_id' => null,
            'type' => 'participation',
            'title' => 'Certificate of participation',
            'student_staff_id' => $user->student_staff_id,
            'participate_year_start' => (int) date('Y'),
            'participate_year_end' => (int) date('Y'),
            'positions_played' => 'Midfielder',
            'scored' => 2,
            'assisted' => 0,
            'file_path' => 'certificates/_pending.pdf',
        ]);

        app(CertificatePdfService::class)->writeToPublicDisk($certificate);
    }
}
