<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Photo;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Streams a gallery image from the public disk. Used with signed URLs so <img src> does not rely on /storage/*.
 */
class PhotoFileDownloadController extends Controller
{
    public function show(Photo $photo): BinaryFileResponse|Response
    {
        $relative = ltrim(str_replace('\\', '/', (string) $photo->image_path), '/');
        if ($relative === '' || str_contains($relative, '..')) {
            abort(404);
        }

        $disk = Storage::disk('public');
        if (! $disk->exists($relative)) {
            abort(404);
        }

        $fullPath = $disk->path($relative);

        $headers = ['Cache-Control' => 'public, max-age=300'];
        try {
            $mime = File::mimeType($fullPath);
            if (is_string($mime) && $mime !== '') {
                $headers['Content-Type'] = $mime;
            }
        } catch (Throwable) {
        }

        return response()->file($fullPath, $headers);
    }
}
