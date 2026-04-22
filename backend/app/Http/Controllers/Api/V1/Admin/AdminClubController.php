<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\UpdateClubRequest;
use App\Models\Club;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminClubController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Club::query()
            ->with(['manager:id,name,email,student_staff_id'])
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
        $club->load(['manager:id,name,email,student_staff_id', 'players']);

        return response()->json([
            'club' => $this->serializeClub($club, includePlayers: true),
        ]);
    }

    public function update(UpdateClubRequest $request, Club $club): JsonResponse
    {
        $data = $request->validated();

        if (($data['status'] ?? null) === 'rejected') {
            $data['league_id'] = null;
        }

        $club->update($data);
        $club->load(['manager:id,name,email,student_staff_id']);
        $club->loadCount('players');

        return response()->json(['club' => $this->serializeClub($club)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClub(Club $club, bool $includePlayers = false): array
    {
        $row = [
            'id' => $club->id,
            'manager_user_id' => $club->manager_user_id,
            'league_id' => $club->league_id,
            'club_name' => $club->club_name,
            'club_photo' => $club->club_photo,
            'club_photo_url' => Storage::disk('public')->url($club->club_photo),
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
        ];

        if ($includePlayers && $club->relationLoaded('players')) {
            $row['players'] = $club->players->map(fn ($p) => $this->serializePlayer($p));
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlayer(\App\Models\Player $player): array
    {
        return [
            'id' => $player->id,
            'club_id' => $player->club_id,
            'full_name' => $player->full_name,
            'student_staff_id' => $player->student_staff_id,
            'jersey_number' => $player->jersey_number,
            'position' => $player->position,
            'player_photo' => $player->player_photo,
            'player_photo_url' => $player->player_photo
                ? Storage::disk('public')->url($player->player_photo)
                : null,
            'created_at' => $player->created_at,
            'updated_at' => $player->updated_at,
        ];
    }
}
