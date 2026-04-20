<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreAdminPlayerRequest;
use App\Http\Requests\Api\V1\Admin\UpdateAdminPlayerRequest;
use App\Models\Club;
use App\Models\Player;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class AdminPlayerController extends Controller
{
    public function index(Club $club): JsonResponse
    {
        $players = $club->players()->orderBy('id')->get()->map(fn (Player $p) => $this->serializePlayer($p));

        return response()->json(['players' => $players]);
    }

    public function store(StoreAdminPlayerRequest $request, Club $club): JsonResponse
    {
        $data = $request->safe()->except(['player_photo']);

        $playerPhotoPath = null;
        if ($request->hasFile('player_photo')) {
            $playerPhotoPath = $request->file('player_photo')->store('players', 'public');
        }

        $player = Player::query()->create([
            'club_id' => $club->id,
            'player_photo' => $playerPhotoPath,
            'student_staff_id' => $data['student_staff_id'],
            'full_name' => $data['full_name'],
            'jersey_number' => $data['jersey_number'] ?? null,
            'position' => $data['position'],
        ]);

        return response()->json(['player' => $this->serializePlayer($player)], 201);
    }

    public function update(UpdateAdminPlayerRequest $request, Player $player): JsonResponse
    {
        $payload = $request->safe()->except(['player_photo']);

        if ($request->hasFile('player_photo')) {
            if ($player->player_photo) {
                Storage::disk('public')->delete($player->player_photo);
            }
            $payload['player_photo'] = $request->file('player_photo')->store('players', 'public');
        }

        $player->update($payload->all());
        $player->refresh();

        return response()->json(['player' => $this->serializePlayer($player)]);
    }

    public function destroy(Player $player): JsonResponse
    {
        if ($player->player_photo) {
            Storage::disk('public')->delete($player->player_photo);
        }
        $player->delete();

        return response()->json(['message' => 'Player deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePlayer(Player $player): array
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
