<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreFixturePlayerStatRequest;
use App\Models\Fixture;
use App\Models\FixturePlayerStat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminFixturePlayerStatController extends Controller
{
    public function index(Fixture $fixture): JsonResponse
    {
        $rows = FixturePlayerStat::query()
            ->where('fixture_id', $fixture->id)
            ->with(['player:id,club_id,full_name,student_staff_id', 'player.club:id,club_name'])
            ->orderBy('stat_type')
            ->orderBy('id')
            ->get()
            ->map(fn (FixturePlayerStat $row) => $this->serialize($row));

        return response()->json(['stats' => $rows]);
    }

    public function store(StoreFixturePlayerStatRequest $request, Fixture $fixture): JsonResponse
    {
        $data = $request->validated();

        $row = FixturePlayerStat::query()->firstOrCreate([
            'fixture_id' => $fixture->id,
            'player_id' => (int) $data['player_id'],
            'stat_type' => (string) $data['stat_type'],
        ]);
        $row->quantity = (int) ($data['quantity'] ?? 1);
        $row->save();

        $row->load(['player:id,club_id,full_name,student_staff_id', 'player.club:id,club_name']);

        return response()->json(['stat' => $this->serialize($row)], 201);
    }

    public function update(Request $request, FixturePlayerStat $fixturePlayerStat): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $fixturePlayerStat->update([
            'quantity' => (int) $data['quantity'],
        ]);
        $fixturePlayerStat->load(['player:id,club_id,full_name,student_staff_id', 'player.club:id,club_name']);

        return response()->json(['stat' => $this->serialize($fixturePlayerStat)]);
    }

    public function destroy(FixturePlayerStat $fixturePlayerStat): JsonResponse
    {
        $fixturePlayerStat->delete();

        return response()->json(['message' => 'Fixture player stat deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(FixturePlayerStat $row): array
    {
        return [
            'id' => $row->id,
            'fixture_id' => $row->fixture_id,
            'player_id' => $row->player_id,
            'stat_type' => $row->stat_type,
            'quantity' => (int) ($row->quantity ?? 1),
            'player_name' => $row->player?->full_name,
            'player_student_staff_id' => $row->player?->student_staff_id,
            'club_name' => $row->player?->club?->club_name,
            'created_at' => $row->created_at,
        ];
    }
}
