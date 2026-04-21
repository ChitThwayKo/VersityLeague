<?php

use App\Http\Controllers\Api\AdminClubController;
use App\Http\Controllers\Api\AdminClubMemberController;
use App\Http\Controllers\Api\AdminFixtureController;
use App\Http\Controllers\Api\AdminMatchResultController;
use App\Http\Controllers\Api\AdminSeasonController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClubController;
use App\Http\Controllers\Api\FixtureController;
use App\Http\Controllers\Api\SeasonController;
use App\Http\Controllers\Api\StandingController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => config('app.name'),
        'time' => now()->toIso8601String(),
    ]);
});

Route::get('/ping', function () {
    return response()->json(['message' => 'pong']);
});

Route::get('/seasons/current', [SeasonController::class, 'current']);

Route::get('/clubs', [ClubController::class, 'index']);
Route::get('/clubs/{club}', [ClubController::class, 'show']);

Route::get('/fixtures', [FixtureController::class, 'index']);
Route::get('/standings', [StandingController::class, 'index']);

Route::middleware('throttle:auth')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::middleware('auth.token')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
});

Route::middleware(['auth.token', 'admin'])->prefix('admin')->group(function () {
    Route::get('/seasons', [AdminSeasonController::class, 'index']);
    Route::post('/seasons', [AdminSeasonController::class, 'store']);
    Route::put('/seasons/{season}', [AdminSeasonController::class, 'update']);

    Route::get('/clubs', [AdminClubController::class, 'index']);
    Route::post('/clubs', [AdminClubController::class, 'store']);
    Route::get('/clubs/{club}', [AdminClubController::class, 'show']);
    Route::put('/clubs/{club}', [AdminClubController::class, 'update']);
    Route::delete('/clubs/{club}', [AdminClubController::class, 'destroy']);

    Route::post('/clubs/{club}/members', [AdminClubMemberController::class, 'store']);
    Route::put('/clubs/{club}/members/{member}', [AdminClubMemberController::class, 'update']);
    Route::delete('/clubs/{club}/members/{member}', [AdminClubMemberController::class, 'destroy']);

    Route::get('/fixtures', [AdminFixtureController::class, 'index']);
    Route::get('/fixtures/{fixture}', [AdminFixtureController::class, 'show']);
    Route::post('/fixtures', [AdminFixtureController::class, 'store']);
    Route::put('/fixtures/{fixture}', [AdminFixtureController::class, 'update']);
    Route::delete('/fixtures/{fixture}', [AdminFixtureController::class, 'destroy']);

    Route::put('/fixtures/{fixture}/result', [AdminMatchResultController::class, 'upsert']);
    Route::delete('/fixtures/{fixture}/result', [AdminMatchResultController::class, 'destroy']);
});
