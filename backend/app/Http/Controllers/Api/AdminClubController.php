<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\ClubMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminClubController extends Controller
{
    public function index(): JsonResponse
    {
        $clubs = Club::query()->withCount('members')->orderBy('name')->get();

        return response()->json([
            'clubs' => $clubs->map(fn (Club $c) => $this->adminSummary($c)),
        ]);
    }

    public function show(Club $club): JsonResponse
    {
        $club->load(['members' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')]);

        return response()->json(['club' => $this->formatClubDetail($club)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedClubFields($request, false);
        $request->validate([
            'logo' => ['nullable', 'image', 'max:4096'],
        ]);

        $path = $this->storeLogo($request);

        $club = Club::query()->create([
            'name' => $data['name'],
            'logo_path' => $path ?? '',
            'founded_year' => $data['founded_year'] ?? null,
            'motto' => $data['motto'] ?? null,
            'status' => $data['status'] ?? Club::STATUS_ACTIVE,
        ]);
        $club->load(['members' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')]);

        return response()->json(['club' => $this->formatClubDetail($club)], 201);
    }

    public function update(Request $request, Club $club): JsonResponse
    {
        $data = $this->validatedClubFields($request, true);
        $request->validate([
            'logo' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($request->hasFile('logo')) {
            $this->deleteLogoIfAny($club);
            $data['logo_path'] = $this->storeLogo($request);
        }

        if ($data !== []) {
            $club->update($data);
        }
        $club->refresh();
        $club->load(['members' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')]);

        return response()->json(['club' => $this->formatClubDetail($club)]);
    }

    public function destroy(Club $club): JsonResponse
    {
        foreach ($club->members as $member) {
            $this->deletePhotoIfAny($member);
        }
        $this->deleteLogoIfAny($club);
        $club->delete();

        return response()->json(['message' => 'Club deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedClubFields(Request $request, bool $partial): array
    {
        $nameRule = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$nameRule, 'string', 'max:255'],
            'founded_year' => ['nullable', 'integer', 'min:1800', 'max:2100'],
            'motto' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in([Club::STATUS_ACTIVE, Club::STATUS_ARCHIVED])],
        ]);
    }

    private function storeLogo(Request $request): ?string
    {
        if (! $request->hasFile('logo')) {
            return null;
        }

        return $request->file('logo')->store('clubs/logos', 'public');
    }

    private function deleteLogoIfAny(Club $club): void
    {
        if ($club->logo_path !== '' && $club->logo_path !== null) {
            Storage::disk('public')->delete($club->logo_path);
        }
    }

    private function deletePhotoIfAny(ClubMember $member): void
    {
        if ($member->photo_path !== '' && $member->photo_path !== null) {
            Storage::disk('public')->delete($member->photo_path);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function adminSummary(Club $club): array
    {
        return [
            'id' => $club->id,
            'name' => $club->name,
            'logo_url' => $club->logoPublicUrl(),
            'founded_year' => $club->founded_year,
            'status' => $club->status,
            'members_count' => $club->members_count,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function formatClubDetail(Club $club): array
    {
        $coaches = $club->members->where('member_type', ClubMember::TYPE_COACH)->values();
        $players = $club->members->where('member_type', ClubMember::TYPE_PLAYER)->values();

        return [
            'id' => $club->id,
            'name' => $club->name,
            'logo_url' => $club->logoPublicUrl(),
            'logo_path' => $club->logo_path,
            'founded_year' => $club->founded_year,
            'motto' => $club->motto,
            'status' => $club->status,
            'coaches' => $coaches->map(fn (ClubMember $m) => $this->memberAdmin($m)),
            'players' => $players->map(fn (ClubMember $m) => $this->memberAdmin($m)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function memberAdmin(ClubMember $m): array
    {
        return [
            'id' => $m->id,
            'member_type' => $m->member_type,
            'name' => $m->name,
            'photo_url' => $m->photoPublicUrl(),
            'photo_path' => $m->photo_path,
            'jersey_number' => $m->jersey_number,
            'position' => $m->position,
            'previous_achievements' => $m->previous_achievements,
            'sort_order' => $m->sort_order,
        ];
    }
}
