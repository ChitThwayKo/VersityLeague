<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Photo;
use App\Support\SignedPhotoDownloadUrl;
use Illuminate\Http\JsonResponse;

class PublicPhotoController extends Controller
{
    public function index(): JsonResponse
    {
        $photos = Photo::query()->orderBy('id')->get()->map(static fn (Photo $photo) => [
            'id' => $photo->id,
            'image_url' => SignedPhotoDownloadUrl::forPhoto($photo),
        ]);

        return response()->json(['photos' => $photos]);
    }
}
