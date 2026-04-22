<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_client_account(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Test Client',
            'email' => 'client@example.com',
            'student_staff_id' => 'STU-1001',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'client')
            ->assertJsonStructure(['token', 'token_type', 'user']);

        $this->assertDatabaseHas('users', [
            'email' => 'client@example.com',
            'student_staff_id' => 'STU-1001',
            'role' => 'client',
        ]);
    }

    public function test_login_with_client_portal(): void
    {
        User::factory()->create([
            'email' => 'u@example.com',
            'password' => 'secret456',
            'role' => UserRole::Client,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'u@example.com',
            'password' => 'secret456',
            'portal' => 'client',
        ]);

        $response->assertOk()->assertJsonPath('user.role', 'client');
    }

    public function test_login_rejects_wrong_portal(): void
    {
        User::factory()->create([
            'email' => 'c@example.com',
            'password' => 'secret456',
            'role' => UserRole::Client,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'c@example.com',
            'password' => 'secret456',
            'portal' => 'admin',
        ]);

        $response->assertUnprocessable();
    }

    public function test_default_admin_can_create_admin_user(): void
    {
        $default = User::factory()->defaultAdmin()->create([
            'email' => 'def@example.com',
            'password' => 'adminpass',
        ]);

        $token = $default->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/v1/admin/users', [
            'name' => 'New Admin',
            'email' => 'newadmin@example.com',
            'student_staff_id' => 'ADM-2001',
            'password' => 'newpassword1',
            'password_confirmation' => 'newpassword1',
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'admin');

        $this->assertDatabaseHas('users', [
            'email' => 'newadmin@example.com',
            'role' => 'admin',
        ]);
    }

    public function test_non_default_admin_cannot_create_admin_user(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'a@example.com',
            'password' => 'pass',
        ]);

        $token = $admin->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/v1/admin/users', [
            'name' => 'Blocked',
            'email' => 'blocked@example.com',
            'student_staff_id' => 'ADM-9999',
            'password' => 'newpassword1',
            'password_confirmation' => 'newpassword1',
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertForbidden();
    }
}
