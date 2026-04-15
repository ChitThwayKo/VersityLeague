<?php

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
