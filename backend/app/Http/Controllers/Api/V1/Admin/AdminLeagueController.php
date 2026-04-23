<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreLeagueRequest;
use App\Http\Requests\Api\V1\Admin\UpdateLeagueRequest;
use App\Models\League;
use App\Services\StandingsRecalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminLeagueController extends Controller
{
    public function __construct(
        private readonly StandingsRecalculationService $standings,
    ) {}
    public function index(): JsonResponse
    {
        $leagues = League::query()
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderBy('id')
            ->get();

        return response()->json(['leagues' => $leagues]);
    }

    public function store(StoreLeagueRequest $request): JsonResponse
    {
        $data = $request->validated();

        $league = DB::transaction(function () use ($data) {
            if ($data['status'] === 'active') {
                League::query()->update(['status' => 'inactive']);
            }

            return League::query()->create($data);
        });

        $this->standings->recalculateForLeague((int) $league->id);

        return response()->json(['league' => $league], 201);
    }

    public function update(UpdateLeagueRequest $request, League $league): JsonResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $league) {
            if (($data['status'] ?? null) === 'active') {
                League::query()->where('id', '!=', $league->id)->update(['status' => 'inactive']);
            }
            $league->update($data);
        });

        $league->refresh();

        $this->standings->recalculateForLeague((int) $league->id);

        return response()->json(['league' => $league]);
    }

    public function destroy(League $league): JsonResponse
    {
        if ($league->clubs()->exists() || $league->fixtures()->exists() || $league->standings()->exists()) {
            return response()->json([
                'message' => 'Cannot delete this season while clubs, fixtures, or standings rows are still linked. Remove or reassign them first.',
            ], 422);
        }

        $league->delete();

        return response()->json(['message' => 'League deleted.']);
    }
}
