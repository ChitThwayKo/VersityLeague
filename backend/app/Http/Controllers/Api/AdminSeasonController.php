<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use App\Support\SeasonGating;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminSeasonController extends Controller
{
    public function index(): JsonResponse
    {
        $seasons = Season::query()->orderByDesc('is_active')->orderByDesc('id')->get();

        return response()->json([
            'seasons' => $seasons->map(fn (Season $s) => SeasonGating::seasonToArray($s)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'registration_opens_at' => ['required', 'date'],
            'registration_closes_at' => ['required', 'date', 'after:registration_opens_at'],
            'started_at' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validated['is_active'] = (bool) ($validated['is_active'] ?? false);

        $season = DB::transaction(function () use ($validated) {
            if ($validated['is_active']) {
                Season::query()->update(['is_active' => false]);
            }

            return Season::query()->create($validated);
        });

        return response()->json([
            'season' => SeasonGating::seasonToArray($season),
        ], 201);
    }

    public function update(Request $request, Season $season): JsonResponse
    {
        $data = $request->validate([
            'label' => ['sometimes', 'string', 'max:255'],
            'registration_opens_at' => ['sometimes', 'date'],
            'registration_closes_at' => ['sometimes', 'date'],
            'started_at' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $opens = isset($data['registration_opens_at'])
            ? Carbon::parse($data['registration_opens_at'])
            : $season->registration_opens_at;
        $closes = isset($data['registration_closes_at'])
            ? Carbon::parse($data['registration_closes_at'])
            : $season->registration_closes_at;

        if ($closes->lte($opens)) {
            throw ValidationException::withMessages([
                'registration_closes_at' => ['Registration must close after it opens.'],
            ]);
        }

        DB::transaction(function () use ($season, $data) {
            if (array_key_exists('is_active', $data) && $data['is_active']) {
                Season::query()->where('id', '!=', $season->id)->update(['is_active' => false]);
            }
            $season->update($data);
        });

        $season->refresh();

        return response()->json([
            'season' => SeasonGating::seasonToArray($season),
        ]);
    }
}
