<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Photo;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class PublicPhotoController extends Controller
{
    public function index(): JsonResponse
    {
        $photos = Photo::query()->orderBy('id')->get()->map(static fn (Photo $photo) => [
            'id' => $photo->id,
            'image_url' => Storage::disk('public')->url($photo->image_path),
        ]);

        return response()->json(['photos' => $photos]);
    }
}
