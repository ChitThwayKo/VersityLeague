<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_client_and_returns_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'username' => 'student001',
            'name' => 'Test Student',
            'email' => 'student001@example.com',
            'password' => 'Password1',
            'password_confirmation' => 'Password1',
            'recaptcha_token' => 'test',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.username', 'student001')
            ->assertJsonPath('user.role', 'client')
            ->assertJsonStructure(['token', 'token_type', 'user']);

        $this->assertDatabaseHas('users', [
            'username' => 'student001',
            'email' => 'student001@example.com',
            'role' => 'client',
        ]);
    }

    public function test_login_client_intent_succeeds_for_client(): void
    {
        User::factory()->create([
            'username' => 'c1',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_CLIENT,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'c1',
            'password' => 'Password1',
            'intent' => 'client',
            'recaptcha_token' => 'test',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.role', 'client')
            ->assertJsonStructure(['token']);
    }

    public function test_login_client_intent_fails_for_admin_account(): void
    {
        User::factory()->create([
            'username' => 'admin1',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_ADMIN,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'admin1',
            'password' => 'Password1',
            'intent' => 'client',
            'recaptcha_token' => 'test',
        ]);

        $response->assertForbidden();
    }

    public function test_login_admin_intent_succeeds_for_main_admin(): void
    {
        User::factory()->create([
            'username' => 'main',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_MAIN_ADMIN,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'main',
            'password' => 'Password1',
            'intent' => 'admin',
            'recaptcha_token' => 'test',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.role', 'main_admin');
    }

    public function test_me_requires_bearer_token(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_me_returns_user_with_valid_token(): void
    {
        $user = User::factory()->create([
            'username' => 'u1',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_CLIENT,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'username' => 'u1',
            'password' => 'Password1',
            'intent' => 'client',
            'recaptcha_token' => 'test',
        ]);

        $token = $login->json('token');

        $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('user.username', 'u1');
    }

    public function test_logout_invalidates_token(): void
    {
        $user = User::factory()->create([
            'username' => 'u2',
            'password' => Hash::make('Password1'),
            'role' => User::ROLE_CLIENT,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'username' => 'u2',
            'password' => 'Password1',
            'intent' => 'client',
            'recaptcha_token' => 'test',
        ]);

        $token = $login->json('token');

        $this->postJson('/api/auth/logout', [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }
}
