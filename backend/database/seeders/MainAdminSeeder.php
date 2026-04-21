<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MainAdminSeeder extends Seeder
{
    public function run(): void
    {
        $username = env('MAIN_ADMIN_USERNAME', 'admin');
        $email = env('MAIN_ADMIN_EMAIL', 'admin@versityleague.local');
        $password = env('MAIN_ADMIN_PASSWORD', 'ChangeMeNow!');

        User::query()->firstOrCreate(
            ['username' => $username],
            [
                'name' => env('MAIN_ADMIN_NAME', 'Main Administrator'),
                'email' => $email,
                'password' => Hash::make($password),
                'role' => User::ROLE_MAIN_ADMIN,
            ]
        );

        if ($this->command) {
            $this->command->info('Main admin ready (username: '.$username.'). Change MAIN_ADMIN_PASSWORD in .env for production.');
        }
    }
}
