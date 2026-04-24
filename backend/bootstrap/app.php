<?php

use App\Http\Controllers\ServePublicStorageFileController;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsClient;
use App\Http\Middleware\EnsureUserIsDefaultAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Must not use the `web` group here: StartSession / DB sessions can 500 on XAMPP when
            // gallery images are simple GETs. Same URL as /storage/* — only SubstituteBindings.
            Route::middleware('storage.public')->group(function () {
                Route::get('storage/{path}', [ServePublicStorageFileController::class, 'show'])
                    ->where('path', '.*')
                    ->name('public-disk.storage');
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->group('storage.public', [
            SubstituteBindings::class,
        ]);
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'client' => EnsureUserIsClient::class,
            'default_admin' => EnsureUserIsDefaultAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
