<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\ClubMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminClubMemberController extends Controller
{
    public function __construct(
        protected AdminClubController $clubs
    ) {}

    public function store(Request $request, Club $club): JsonResponse
    {
        $validated = $this->validateMember($request, false, null);
        $request->validate([
            'photo' => ['nullable', 'image', 'max:4096'],
        ]);

        $path = $this->storePhoto($request);

        $member = $club->members()->create([
            'member_type' => $validated['member_type'],
            'name' => $validated['name'],
            'photo_path' => $path ?? '',
            'jersey_number' => $validated['jersey_number'] ?? null,
            'position' => $validated['position'] ?? null,
            'previous_achievements' => $validated['previous_achievements'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        $club->refresh();
        $club->load(['members' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')]);

        return response()->json([
            'member' => $this->memberPayload($member),
            'club' => $this->clubs->formatClubDetail($club),
        ], 201);
    }

    public function update(Request $request, Club $club, ClubMember $member): JsonResponse
    {
        if ($member->club_id !== $club->id) {
            abort(404);
        }

        $validated = $this->validateMember($request, true, $member);
        $request->validate([
            'photo' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($request->hasFile('photo')) {
            $this->deletePhotoIfAny($member);
            $validated['photo_path'] = $this->storePhoto($request);
        }

        if ($validated !== []) {
            $member->update($validated);
        }
        $member->refresh();
        $club->refresh();
        $club->load(['members' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')]);

        return response()->json([
            'member' => $this->memberPayload($member),
            'club' => $this->clubs->formatClubDetail($club),
        ]);
    }

    public function destroy(Club $club, ClubMember $member): JsonResponse
    {
        if ($member->club_id !== $club->id) {
            abort(404);
        }

        $this->deletePhotoIfAny($member);
        $member->delete();

        return response()->json(['message' => 'Member removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateMember(Request $request, bool $partial, ?ClubMember $existing): array
    {
        $typeRule = $partial ? 'sometimes' : 'required';
        $nameRule = $partial ? 'sometimes' : 'required';

        $needsPlayerFields = static function () use ($request, $partial, $existing): bool {
            if ($partial) {
                return false;
            }
            $type = $request->input('member_type') ?? $existing?->member_type;

            return $type === ClubMember::TYPE_PLAYER;
        };

        return $request->validate([
            'member_type' => [$typeRule, Rule::in([ClubMember::TYPE_COACH, ClubMember::TYPE_PLAYER])],
            'name' => [$nameRule, 'string', 'max:255'],
            'jersey_number' => [
                Rule::requiredIf($needsPlayerFields),
                'nullable',
                'integer',
                'min:1',
                'max:999',
            ],
            'position' => [
                Rule::requiredIf($needsPlayerFields),
                'nullable',
                'string',
                'max:64',
            ],
            'previous_achievements' => ['nullable', 'string', 'max:5000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999999'],
        ]);
    }

    private function storePhoto(Request $request): ?string
    {
        if (! $request->hasFile('photo')) {
            return null;
        }

        return $request->file('photo')->store('clubs/members', 'public');
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
    private function memberPayload(ClubMember $m): array
    {
        return [
            'id' => $m->id,
            'club_id' => $m->club_id,
            'member_type' => $m->member_type,
            'name' => $m->name,
            'photo_url' => $m->photoPublicUrl(),
            'jersey_number' => $m->jersey_number,
            'position' => $m->position,
            'previous_achievements' => $m->previous_achievements,
            'sort_order' => $m->sort_order,
        ];
    }
}
