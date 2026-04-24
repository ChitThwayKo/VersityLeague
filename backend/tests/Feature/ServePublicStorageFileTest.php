<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ServePublicStorageFileTest extends TestCase
{
    public function test_storage_route_serves_public_disk_file(): void
    {
        Storage::disk('public')->put('photos/test-serve.jpg', random_bytes(32));

        $this->get('/storage/photos/test-serve.jpg')->assertOk();
    }

    public function test_storage_route_rejects_path_traversal(): void
    {
        $this->get('/storage/../.env')->assertNotFound();
    }

    public function test_storage_route_404_when_missing(): void
    {
        $this->get('/storage/photos/does-not-exist-xyz.jpg')->assertNotFound();
    }

    public function test_storage_serves_under_xampp_style_subdirectory_uri(): void
    {
        Storage::disk('public')->put('photos/nested.jpg', 'fake-image');

        $publicIndex = str_replace('\\', '/', base_path('public/index.php'));

        $response = $this->call('GET', '/VersityLeague_V4_D9/backend/public/storage/photos/nested.jpg', [], [], [], [
            'HTTP_HOST' => 'localhost:8080',
            'SERVER_PORT' => '8080',
            'REQUEST_URI' => '/VersityLeague_V4_D9/backend/public/storage/photos/nested.jpg',
            'SCRIPT_NAME' => '/VersityLeague_V4_D9/backend/public/index.php',
            'SCRIPT_FILENAME' => $publicIndex,
            'PHP_SELF' => '/VersityLeague_V4_D9/backend/public/index.php',
        ]);

        $response->assertOk();
    }
}
