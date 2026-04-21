<?php

namespace Tests\Feature;

use App\Models\Season;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminSeasonTest extends TestCase
{
    use RefreshDatabase;

    private function bearer(User $user): array
    {
        $login = $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'Password1',
            'intent' => str_contains($user->role, 'admin') ? 'admin' : 'client',
            'recaptcha_token' => 'test',
        ]);

        return ['Authorization' => 'Bearer '.$login->json('token')];
    }

    public function test_client_cannot_list_admin_seasons(): void
    {
        $user = User::factory()->create([
            'username' => 'c1',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_CLIENT,
        ]);

        $this->getJson('/api/admin/seasons', $this->bearer($user))
            ->assertForbidden();
    }

    public function test_admin_can_create_and_update_season(): void
    {
        $admin = User::factory()->create([
            'username' => 'a1',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_ADMIN,
        ]);

        $headers = $this->bearer($admin);

        $create = $this->postJson('/api/admin/seasons', [
            'label' => 'Season A',
            'registration_opens_at' => '2026-09-01T00:00:00Z',
            'registration_closes_at' => '2026-09-15T23:59:59Z',
            'started_at' => null,
            'is_active' => true,
        ], $headers);

        $create->assertCreated()
            ->assertJsonPath('season.label', 'Season A');

        $id = $create->json('season.id');

        $this->putJson("/api/admin/seasons/{$id}", [
            'label' => 'Season A+',
        ], $headers)->assertOk()
            ->assertJsonPath('season.label', 'Season A+');
    }

    public function test_setting_active_deactivates_other_seasons(): void
    {
        $admin = User::factory()->create([
            'username' => 'a2',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_ADMIN,
        ]);
        $headers = $this->bearer($admin);

        $this->postJson('/api/admin/seasons', [
            'label' => 'First',
            'registration_opens_at' => '2026-01-01T00:00:00Z',
            'registration_closes_at' => '2026-01-31T23:59:59Z',
            'is_active' => true,
        ], $headers)->assertCreated();

        $second = $this->postJson('/api/admin/seasons', [
            'label' => 'Second',
            'registration_opens_at' => '2026-02-01T00:00:00Z',
            'registration_closes_at' => '2026-02-28T23:59:59Z',
            'is_active' => true,
        ], $headers)->assertCreated();

        $this->assertDatabaseHas('seasons', ['label' => 'Second', 'is_active' => true]);
        $this->assertDatabaseHas('seasons', ['label' => 'First', 'is_active' => false]);

        $this->assertSame($second->json('season.id'), Season::query()->where('is_active', true)->value('id'));
    }
}
