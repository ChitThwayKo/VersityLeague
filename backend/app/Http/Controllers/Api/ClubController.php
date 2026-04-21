<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\ClubMember;
use Illuminate\Http\JsonResponse;

class ClubController extends Controller
{
    public function index(): JsonResponse
    {
        $clubs = Club::query()
            ->where('status', Club::STATUS_ACTIVE)
            ->orderBy('name')
            ->get();

        return response()->json([
            'clubs' => $clubs->map(fn (Club $c) => $this->summary($c)),
        ]);
    }

    public function show(Club $club): JsonResponse
    {
        if ($club->status !== Club::STATUS_ACTIVE) {
            abort(404);
        }

        $club->load(['members' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')]);

        return response()->json($this->detail($club));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Club $club): array
    {
        return [
            'id' => $club->id,
            'name' => $club->name,
            'logo_url' => $club->logoPublicUrl(),
            'founded_year' => $club->founded_year,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(Club $club): array
    {
        $coaches = $club->members->where('member_type', ClubMember::TYPE_COACH)->values();
        $players = $club->members->where('member_type', ClubMember::TYPE_PLAYER)->values();

        return [
            'club' => [
                'id' => $club->id,
                'name' => $club->name,
                'logo_url' => $club->logoPublicUrl(),
                'founded_year' => $club->founded_year,
                'motto' => $club->motto,
            ],
            'coaches' => $coaches->map(fn (ClubMember $m) => $this->memberPublic($m)),
            'players' => $players->map(fn (ClubMember $m) => $this->memberPublic($m)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function memberPublic(ClubMember $m): array
    {
        return [
            'id' => $m->id,
            'name' => $m->name,
            'photo_url' => $m->photoPublicUrl(),
            'jersey_number' => $m->jersey_number,
            'position' => $m->position,
            'previous_achievements' => $m->previous_achievements,
        ];
    }
}
