<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Day 7 — end-to-end smoke: public read routes, client session, certificates list, logout.
 */
class Day7MvpSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_mvp_public_routes_and_client_session_smoke(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->getJson('/api/v1/standings')
            ->assertOk()
            ->assertJsonStructure(['league', 'standings']);

        $this->getJson('/api/v1/fixtures')
            ->assertOk()
            ->assertJsonStructure(['fixtures']);

        $this->getJson('/api/v1/photos')
            ->assertOk()
            ->assertJsonStructure(['photos']);

        User::factory()->create([
            'email' => 'mvp-smoke@example.com',
            'password' => 'password',
            'role' => UserRole::Client,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'mvp-smoke@example.com',
            'password' => 'password',
            'portal' => 'client',
        ]);
        $login->assertOk()->assertJsonStructure(['token', 'user']);
        $token = $login->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'mvp-smoke@example.com');

        $this->withToken($token)->getJson('/api/v1/certificates')
            ->assertOk()
            ->assertJsonStructure(['certificates']);

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();
    }
}
