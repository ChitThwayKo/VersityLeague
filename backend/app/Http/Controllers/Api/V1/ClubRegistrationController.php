<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreClubRegistrationRequest;
use App\Models\Club;
use App\Models\Player;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ClubRegistrationController extends Controller
{
    public function store(StoreClubRegistrationRequest $request): JsonResponse
    {
        $user = $request->user();

        $clubPhotoPath = $request->file('club_photo')->store('clubs', 'public');

        $playerPhotoPath = null;
        if ($request->hasFile('player_photo')) {
            $playerPhotoPath = $request->file('player_photo')->store('players', 'public');
        }

        [$club, $player] = DB::transaction(function () use ($request, $user, $clubPhotoPath, $playerPhotoPath) {
            $validated = $request->validated();

            $club = Club::query()->create([
                'manager_user_id' => $user->id,
                'league_id' => null,
                'club_name' => $validated['club_name'],
                'club_photo' => $clubPhotoPath,
                'status' => 'pending',
            ]);

            $player = Player::query()->create([
                'club_id' => $club->id,
                'player_photo' => $playerPhotoPath,
                'student_staff_id' => $validated['player_student_staff_id'],
                'full_name' => $validated['player_full_name'],
                'jersey_number' => $validated['jersey_number'] ?? null,
                'position' => $validated['position'],
            ]);

            return [$club, $player];
        });

        return response()->json([
            'message' => 'Registration submitted. Your club is pending approval.',
            'club' => [
                'id' => $club->id,
                'club_name' => $club->club_name,
                'status' => $club->status,
                'club_photo_url' => Storage::disk('public')->url($club->club_photo),
            ],
            'player' => [
                'id' => $player->id,
                'full_name' => $player->full_name,
                'student_staff_id' => $player->student_staff_id,
                'player_photo_url' => $player->player_photo
                    ? Storage::disk('public')->url($player->player_photo)
                    : null,
            ],
        ], 201);
    }
}
