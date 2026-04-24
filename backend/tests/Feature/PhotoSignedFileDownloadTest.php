<?php

namespace Tests\Feature;

use App\Models\Photo;
use App\Support\SignedPhotoDownloadUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PhotoSignedFileDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_photo_url_serves_file_bytes(): void
    {
        Storage::disk('public')->put('photos/signed-t.jpg', random_bytes(32));
        $photo = Photo::query()->create(['image_path' => 'photos/signed-t.jpg']);

        $url = SignedPhotoDownloadUrl::forPhoto($photo);
        $this->assertStringContainsString('/api/v1/photos/'.$photo->id.'/file', $url);
        $this->assertStringContainsString('signature=', $url);

        $pathAndQuery = parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY);
        $this->get($pathAndQuery)->assertOk();
    }

    public function test_invalid_signature_returns_403(): void
    {
        Storage::disk('public')->put('photos/x.jpg', 'x');
        $photo = Photo::query()->create(['image_path' => 'photos/x.jpg']);

        $this->get('/api/v1/photos/'.$photo->id.'/file?signature=bad&expires='.(time() + 3600))->assertForbidden();
    }
}
