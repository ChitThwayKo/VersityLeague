<?php

namespace App\Support;

use App\Models\Photo;
use Illuminate\Support\Facades\URL;

/**
 * Builds a time-limited signed URL to download a gallery image bytes via the API.
 * Use this for <img src> so previews work even when /storage/* is broken on the web server.
 */
final class SignedPhotoDownloadUrl
{
    public static function forPhoto(Photo $photo): string
    {
        $root = null;
        try {
            $root = request()?->root();
        } catch (\Throwable) {
            $root = null;
        }

        $appUrl = config('app.url');
        $forced = is_string($root) && str_starts_with($root, 'http')
            && (! is_string($appUrl) || rtrim($root, '/') !== rtrim($appUrl, '/'));

        if ($forced) {
            URL::forceRootUrl($root);
        }

        try {
            return URL::temporarySignedRoute(
                'api.v1.photos.file',
                now()->addHours(24),
                ['photo' => $photo->id],
                absolute: true,
            );
        } finally {
            if ($forced) {
                URL::forceRootUrl(is_string($appUrl) && $appUrl !== '' ? $appUrl : null);
            }
        }
    }
}
