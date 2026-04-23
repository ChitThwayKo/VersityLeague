<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreClubRegistrationRequest;
use App\Models\Club;
use App\Models\Player;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ClubRegistrationController extends Controller
{
    public function store(StoreClubRegistrationRequest $request): JsonResponse
    {
        $user = $request->user();

        $clubPhotoPath = $request->file('club_photo')->store('clubs', 'public');

        [$club, $players] = DB::transaction(function () use ($request, $user, $clubPhotoPath) {
            $validated = $request->validated();

            $club = Club::query()->create([
                'manager_user_id' => $user->id,
                'league_id' => $validated['league_id'],
                'club_name' => $validated['club_name'],
                'club_photo' => $clubPhotoPath,
                'status' => 'pending',
            ]);

            $players = [];
            foreach ($validated['players'] as $index => $playerData) {
                $playerPhotoPath = null;
                if ($request->hasFile("players.$index.player_photo")) {
                    $playerPhotoPath = $request->file("players.$index.player_photo")->store('players', 'public');
                }

                $players[] = Player::query()->create([
                    'club_id' => $club->id,
                    'player_photo' => $playerPhotoPath,
                    'student_staff_id' => $playerData['student_staff_id'],
                    'full_name' => $playerData['full_name'],
                    'jersey_number' => $playerData['jersey_number'] ?? null,
                    'position' => $playerData['position'] ?? null,
                    'role' => $playerData['role'],
                ]);
            }

            return [$club, $players];
        });

        return response()->json([
            'message' => 'Registration submitted. Your club is pending approval.',
            'club' => [
                'id' => $club->id,
                'club_name' => $club->club_name,
                'status' => $club->status,
                'club_photo_url' => PublicStorageUrl::url($club->club_photo),
            ],
            'players' => array_map(static fn (Player $player): array => [
                'id' => $player->id,
                'full_name' => $player->full_name,
                'student_staff_id' => $player->student_staff_id,
                'role' => $player->role,
                'position' => $player->position,
                'player_photo_url' => PublicStorageUrl::url($player->player_photo),
            ], $players),
        ], 201);
    }
}
