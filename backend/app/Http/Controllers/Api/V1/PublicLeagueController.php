<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\League;
use Illuminate\Http\JsonResponse;

class PublicLeagueController extends Controller
{
    public function active(): JsonResponse
    {
        $leagues = League::query()
            ->where('status', 'active')
            ->orderBy('starts_on')
            ->orderBy('id')
            ->get();

        return response()->json([
            'leagues' => $leagues,
        ]);
    }
}
