<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class DefaultAdminSeeder extends Seeder
{
    public function run(): void
    {
        $cfg = config('versity.default_admin');

        User::query()->updateOrCreate(
            ['email' => $cfg['email']],
            [
                'name' => $cfg['name'],
                'student_staff_id' => $cfg['student_staff_id'],
                'password' => $cfg['password'],
                'role' => UserRole::DefaultAdmin,
            ]
        );
    }
}
