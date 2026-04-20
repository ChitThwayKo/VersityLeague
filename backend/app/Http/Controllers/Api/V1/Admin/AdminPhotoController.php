<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StorePhotoRequest;
use App\Http\Requests\Api\V1\Admin\UpdatePhotoRequest;
use App\Models\Photo;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class AdminPhotoController extends Controller
{
    public const MAX_PHOTOS = 5;

    public function index(): JsonResponse
    {
        $photos = Photo::query()->orderBy('id')->get()->map(fn (Photo $photo) => $this->serializePhoto($photo));

        return response()->json(['photos' => $photos, 'max_photos' => self::MAX_PHOTOS]);
    }

    public function store(StorePhotoRequest $request): JsonResponse
    {
        if (Photo::query()->count() >= self::MAX_PHOTOS) {
            return response()->json([
                'message' => 'The gallery is limited to '.self::MAX_PHOTOS.' photos. Delete one before adding another.',
            ], 422);
        }

        $path = $request->file('image')->store('photos', 'public');
        $photo = Photo::query()->create(['image_path' => $path]);

        return response()->json(['photo' => $this->serializePhoto($photo)], 201);
    }

    public function update(UpdatePhotoRequest $request, Photo $photo): JsonResponse
    {
        $old = $photo->image_path;
        $path = $request->file('image')->store('photos', 'public');
        $photo->update(['image_path' => $path]);

        if ($old && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        $photo->refresh();

        return response()->json(['photo' => $this->serializePhoto($photo)]);
    }

    public function destroy(Photo $photo): JsonResponse
    {
        if ($photo->image_path) {
            Storage::disk('public')->delete($photo->image_path);
        }
        $photo->delete();

        return response()->json(['message' => 'Photo removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePhoto(Photo $photo): array
    {
        return [
            'id' => $photo->id,
            'image_path' => $photo->image_path,
            'image_url' => Storage::disk('public')->url($photo->image_path),
            'created_at' => $photo->created_at,
            'updated_at' => $photo->updated_at,
        ];
    }
}
