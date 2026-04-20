<?php

use App\Http\Controllers\Api\V1\Admin\AdminClubController;
use App\Http\Controllers\Api\V1\Admin\AdminFixtureController;
use App\Http\Controllers\Api\V1\Admin\AdminLeagueController;
use App\Http\Controllers\Api\V1\Admin\AdminPhotoController;
use App\Http\Controllers\Api\V1\Admin\AdminPlayerController;
use App\Http\Controllers\Api\V1\Admin\AdminUserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClubRegistrationController;
use Illuminate\Support\Facades\Route;

/*
| Versity League API — versioned under /api/v1 (see docs/Implementation.md).
*/

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'app' => config('app.name'),
            'status' => 'ok',
        ]);
    });

    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::middleware(['admin', 'default_admin'])->prefix('admin')->group(function (): void {
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::post('/users', [AdminUserController::class, 'store']);
        });

        Route::middleware(['admin'])->prefix('admin')->group(function (): void {
            Route::get('/leagues', [AdminLeagueController::class, 'index']);
            Route::post('/leagues', [AdminLeagueController::class, 'store']);
            Route::patch('/leagues/{league}', [AdminLeagueController::class, 'update']);
            Route::delete('/leagues/{league}', [AdminLeagueController::class, 'destroy']);

            Route::get('/clubs', [AdminClubController::class, 'index']);
            Route::get('/clubs/{club}', [AdminClubController::class, 'show']);
            Route::patch('/clubs/{club}', [AdminClubController::class, 'update']);

            Route::get('/clubs/{club}/players', [AdminPlayerController::class, 'index']);
            Route::post('/clubs/{club}/players', [AdminPlayerController::class, 'store']);
            Route::patch('/players/{player}', [AdminPlayerController::class, 'update']);
            Route::delete('/players/{player}', [AdminPlayerController::class, 'destroy']);

            Route::get('/fixtures', [AdminFixtureController::class, 'index']);
            Route::post('/fixtures', [AdminFixtureController::class, 'store']);
            Route::patch('/fixtures/{fixture}', [AdminFixtureController::class, 'update']);
            Route::delete('/fixtures/{fixture}', [AdminFixtureController::class, 'destroy']);

            Route::get('/photos', [AdminPhotoController::class, 'index']);
            Route::post('/photos', [AdminPhotoController::class, 'store']);
            Route::patch('/photos/{photo}', [AdminPhotoController::class, 'update']);
            Route::delete('/photos/{photo}', [AdminPhotoController::class, 'destroy']);
        });

        Route::post('/club-registrations', [ClubRegistrationController::class, 'store'])
            ->middleware('client');
    });
});
