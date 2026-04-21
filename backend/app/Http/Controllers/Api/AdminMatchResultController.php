<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fixture;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminMatchResultController extends Controller
{
    public function __construct(
        protected AdminFixtureController $fixtures
    ) {}

    public function upsert(Request $request, Fixture $fixture): JsonResponse
    {
        $data = $request->validate([
            'home_goals' => ['required', 'integer', 'min:0', 'max:99'],
            'away_goals' => ['required', 'integer', 'min:0', 'max:99'],
        ]);

        DB::transaction(function () use ($fixture, $data): void {
            $fixture->result()->updateOrCreate([], [
                'home_goals' => $data['home_goals'],
                'away_goals' => $data['away_goals'],
            ]);
            $fixture->update(['status' => Fixture::STATUS_COMPLETED]);
        });

        $fixture->refresh();
        $fixture->load(['homeClub', 'awayClub', 'season', 'result']);

        return response()->json(['fixture' => $this->fixtures->formatFixtureAdmin($fixture)]);
    }

    public function destroy(Fixture $fixture): JsonResponse
    {
        DB::transaction(function () use ($fixture): void {
            $fixture->result()?->delete();
            if ($fixture->status === Fixture::STATUS_COMPLETED) {
                $fixture->update(['status' => Fixture::STATUS_SCHEDULED]);
            }
        });

        $fixture->refresh();
        $fixture->load(['homeClub', 'awayClub', 'season', 'result']);

        return response()->json(['fixture' => $this->fixtures->formatFixtureAdmin($fixture)]);
    }
}
