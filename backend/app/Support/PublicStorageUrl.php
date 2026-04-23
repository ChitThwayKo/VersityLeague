<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

/**
 * Builds absolute URLs for files on the public disk so JSON APIs match the current request
 * (e.g. XAMPP on :8080) instead of Laravel's configured APP_URL (often :8000).
 */
final class PublicStorageUrl
{
    public static function url(?string $diskRelativePath): ?string
    {
        if ($diskRelativePath === null || $diskRelativePath === '') {
            return null;
        }

        $path = ltrim(str_replace('\\', '/', $diskRelativePath), '/');

        try {
            $root = request()?->root();
            if (is_string($root) && $root !== '' && str_starts_with($root, 'http')) {
                return rtrim($root, '/').'/storage/'.$path;
            }
        } catch (\Throwable) {
            // fall through to Storage::url
        }

        return Storage::disk('public')->url($path);
    }
}
