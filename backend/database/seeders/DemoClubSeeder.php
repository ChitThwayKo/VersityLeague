<?php

namespace Database\Seeders;

use App\Models\Club;
use App\Models\ClubMember;
use Illuminate\Database\Seeder;

class DemoClubSeeder extends Seeder
{
    public function run(): void
    {
        if (Club::query()->exists()) {
            return;
        }

        $wolves = Club::query()->create([
            'name' => 'City Wolves FC',
            'logo_path' => '',
            'founded_year' => 2018,
            'motto' => 'Lorem ipsum dolor sit amet.',
            'status' => Club::STATUS_ACTIVE,
        ]);

        $wolves->members()->createMany([
            [
                'member_type' => ClubMember::TYPE_COACH,
                'name' => 'Alex Morgan',
                'photo_path' => '',
                'jersey_number' => null,
                'position' => null,
                'previous_achievements' => 'Regional cup 2024.',
                'sort_order' => 0,
            ],
            [
                'member_type' => ClubMember::TYPE_PLAYER,
                'name' => 'Jordan Lee',
                'photo_path' => '',
                'jersey_number' => 10,
                'position' => 'Midfielder',
                'previous_achievements' => 'Youth league MVP.',
                'sort_order' => 1,
            ],
            [
                'member_type' => ClubMember::TYPE_PLAYER,
                'name' => 'Sam Rivera',
                'photo_path' => '',
                'jersey_number' => 7,
                'position' => 'Forward',
                'previous_achievements' => null,
                'sort_order' => 2,
            ],
        ]);

        $eagles = Club::query()->create([
            'name' => 'Campus Eagles',
            'logo_path' => '',
            'founded_year' => 2020,
            'motto' => null,
            'status' => Club::STATUS_ACTIVE,
        ]);

        $eagles->members()->createMany([
            [
                'member_type' => ClubMember::TYPE_COACH,
                'name' => 'Taylor Brooks',
                'photo_path' => '',
                'jersey_number' => null,
                'position' => null,
                'previous_achievements' => 'Former semi-pro.',
                'sort_order' => 0,
            ],
            [
                'member_type' => ClubMember::TYPE_PLAYER,
                'name' => 'Casey Ng',
                'photo_path' => '',
                'jersey_number' => 4,
                'position' => 'Defender',
                'previous_achievements' => null,
                'sort_order' => 1,
            ],
        ]);
    }
}
