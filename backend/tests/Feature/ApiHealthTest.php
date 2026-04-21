<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiHealthTest extends TestCase
{
    public function test_health_returns_json(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure(['ok', 'app', 'time']);
    }

    public function test_ping_returns_json(): void
    {
        $response = $this->getJson('/api/ping');

        $response->assertOk()
            ->assertJson(['message' => 'pong']);
    }
}
