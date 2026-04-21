<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use App\Support\SeasonGating;
use Illuminate\Http\JsonResponse;

class SeasonController extends Controller
{
    public function current(): JsonResponse
    {
        $active = Season::query()->where('is_active', true)->first();

        return response()->json(SeasonGating::payload($active));
    }
}
