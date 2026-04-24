<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\UpdateClubRequest;
use App\Models\Club;
use App\Models\Fixture;
use App\Models\Player;
use App\Services\StandingsRecalculationService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminClubController extends Controller
{
    public function __construct(
        private readonly StandingsRecalculationService $standings,
    ) {}
    public function index(Request $request): JsonResponse
    {
        $query = Club::query()
            ->with(['manager:id,name,email,student_staff_id', 'league:id,name,year'])
            ->with(['players' => function ($query): void {
                $query->select(['id', 'club_id', 'full_name', 'student_staff_id', 'position', 'jersey_number', 'player_photo']);
                $query->withCount([
                    'fixtureStats as goals_count' => fn ($q) => $q->where('stat_type', 'goal'),
                    'fixtureStats as assists_count' => fn ($q) => $q->where('stat_type', 'assist'),
                ]);
            }])
            ->withCount('players')
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $clubs = $query->get()->map(fn (Club $club) => $this->serializeClub($club));

        return response()->json(['clubs' => $clubs]);
    }

    public function show(Club $club): JsonResponse
    {
        $club->load([
            'manager:id,name,email,student_staff_id',
            'players' => function ($query): void {
                $query->withCount([
                    'fixtureStats as goals_count' => fn ($q) => $q->where('stat_type', 'goal'),
                    'fixtureStats as assists_count' => fn ($q) => $q->where('stat_type', 'assist'),
                ]);
            },
        ]);

        return response()->json([
            'club' => $this->serializeClub($club),
        ]);
    }

    public function update(UpdateClubRequest $request, Club $club): JsonResponse
    {
        $data = $request->validated();

        if (($data['status'] ?? null) === 'rejected') {
            $data['league_id'] = null;
        }

        $previousLeagueId = $club->league_id ? (int) $club->league_id : null;

        $club->update($data);
        $club->load(['manager:id,name,email,student_staff_id']);
        $club->loadCount('players');

        $newLeagueId = $club->league_id ? (int) $club->league_id : null;
        foreach (array_unique(array_filter([$previousLeagueId, $newLeagueId])) as $leagueId) {
            $this->standings->recalculateForLeague($leagueId);
        }

        return response()->json(['club' => $this->serializeClub($club)]);
    }

    public function destroy(Club $club): JsonResponse
    {
        $leagueIds = collect();
        if ($club->league_id) {
            $leagueIds->push((int) $club->league_id);
        }
        $leagueIds = $leagueIds->merge(
            Fixture::query()
                ->where('home_club_id', $club->id)
                ->orWhere('away_club_id', $club->id)
                ->pluck('league_id')
        )->unique()->filter()->values()->all();

        if ($club->club_photo) {
            Storage::disk('public')->delete($club->club_photo);
        }

        $club->delete();

        foreach ($leagueIds as $leagueId) {
            $this->standings->recalculateForLeague((int) $leagueId);
        }

        return response()->json(['message' => 'Club deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClub(Club $club): array
    {
        return [
            'id' => $club->id,
            'manager_user_id' => $club->manager_user_id,
            'league_id' => $club->league_id,
            'club_name' => $club->club_name,
            'club_photo' => $club->club_photo,
            'club_photo_url' => PublicStorageUrl::url($club->club_photo),
            'status' => $club->status,
            'created_at' => $club->created_at,
            'updated_at' => $club->updated_at,
            'players_count' => $club->players_count ?? $club->players()->count(),
            'manager' => $club->relationLoaded('manager') && $club->manager
                ? [
                    'id' => $club->manager->id,
                    'name' => $club->manager->name,
                    'email' => $club->manager->email,
                    'student_staff_id' => $club->manager->student_staff_id,
                ]
                : null,
            'league' => $club->relationLoaded('league') && $club->league
                ? [
                    'id' => $club->league->id,
                    'name' => $club->league->name,
                    'year' => $club->league->year,
                ]
                : null,
            'players' => $club->relationLoaded('players')
                ? $club->players->map(fn (Player $p) => $this->serializePlayer($p))->values()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlayer(Player $player): array
    {
        $fallbackGoals = $player->fixtureStats()->where('stat_type', 'goal')->count();
        $fallbackAssists = $player->fixtureStats()->where('stat_type', 'assist')->count();

        return [
            'id' => $player->id,
            'club_id' => $player->club_id,
            'full_name' => $player->full_name,
            'student_staff_id' => $player->student_staff_id,
            'jersey_number' => $player->jersey_number,
            'position' => $player->position,
            'player_photo' => $player->player_photo,
            'player_photo_url' => PublicStorageUrl::url($player->player_photo),
            'goals_count' => (int) ($player->goals_count ?? $fallbackGoals),
            'assists_count' => (int) ($player->assists_count ?? $fallbackAssists),
            'created_at' => $player->created_at,
            'updated_at' => $player->updated_at,
        ];
    }
}
