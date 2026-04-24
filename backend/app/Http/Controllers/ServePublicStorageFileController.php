<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Serves files from the "public" disk root (storage/app/public) for URLs under /storage/…
 * when Apache cannot follow a junction/symlink (common 403 on XAMPP + Windows).
 */
final class ServePublicStorageFileController extends Controller
{
    public function show(Request $request, string $path): BinaryFileResponse|Response
    {
        $relative = $this->resolvePublicDiskRelativePath($request, $path);
        if ($relative === null) {
            abort(404);
        }

        $fullPath = storage_path('app/public/'.$relative);

        $headers = ['Cache-Control' => 'public, max-age=86400'];
        try {
            $mime = File::mimeType($fullPath);
            if (is_string($mime) && $mime !== '') {
                $headers['Content-Type'] = $mime;
            }
        } catch (Throwable) {
            // finfo can fail on some Windows/PHP builds; Symfony will sniff from extension.
        }

        return response()->file($fullPath, $headers);
    }

    /**
     * @return non-empty-string|null
     */
    private function resolvePublicDiskRelativePath(Request $request, string $routePath): ?string
    {
        $candidates = [];

        foreach ([$routePath, $this->tailAfterStorageMarker($request->getRequestUri()), $this->tailAfterStorageMarker($request->path())] as $raw) {
            $normalized = $this->normalizePublicDiskRelativePath($raw);
            if ($normalized !== '') {
                $candidates[] = $normalized;
            }
        }

        foreach (array_unique($candidates) as $relative) {
            if (str_contains($relative, '..')) {
                continue;
            }
            if (is_file(storage_path('app/public/'.$relative))) {
                return $relative;
            }
        }

        return null;
    }

    private function tailAfterStorageMarker(string $value): string
    {
        $value = str_replace('\\', '/', rawurldecode($value));
        if (false !== ($pos = stripos($value, '/storage/'))) {
            return substr($value, $pos + strlen('/storage/'));
        }
        if (str_starts_with(strtolower($value), 'storage/')) {
            return substr($value, strlen('storage/'));
        }

        return '';
    }

    private function normalizePublicDiskRelativePath(string $path): string
    {
        $path = str_replace('\\', '/', trim($path));
        $path = ltrim($path, '/');
        // URLs are always /storage/{diskPath} where diskPath is usually "photos/…".
        // Some legacy rows may store "storage/photos/…" — strip a single leading "storage/".
        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }

        return $path;
    }
}
