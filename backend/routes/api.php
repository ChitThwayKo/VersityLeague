<?php

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

        Route::post('/admin/users', [AdminUserController::class, 'store'])
            ->middleware('default_admin');

        Route::post('/club-registrations', [ClubRegistrationController::class, 'store'])
            ->middleware('client');
    });
});
