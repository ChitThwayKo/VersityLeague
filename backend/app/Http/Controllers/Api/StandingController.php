<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\StandingsService;
use Illuminate\Http\JsonResponse;

class StandingController extends Controller
{
    public function __construct(
        protected StandingsService $standings
    ) {}

    public function index(): JsonResponse
    {
        return response()->json($this->standings->forActiveSeason());
    }
}
