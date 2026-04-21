<?php

namespace Database\Seeders;

use App\Models\Season;
use Illuminate\Database\Seeder;

class DemoSeasonSeeder extends Seeder
{
    public function run(): void
    {
        if (Season::query()->where('is_active', true)->exists()) {
            return;
        }

        Season::query()->create([
            'label' => 'Development 2026',
            'registration_opens_at' => now()->subDay(),
            'registration_closes_at' => now()->addMonth(),
            'started_at' => null,
            'is_active' => true,
        ]);
    }
}
