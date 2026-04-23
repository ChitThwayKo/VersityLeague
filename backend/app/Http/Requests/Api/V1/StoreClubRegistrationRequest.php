<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreClubRegistrationRequest extends FormRequest
{
    /**
     * @var array<int, string>
     */
    private const PLAYER_ROLES = [
        'Head Coach',
        'Assistant Coach',
        'Captain',
        'Vice Captain',
        'Player',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'league_id' => ['required', 'integer', 'exists:leagues,id'],
            'club_name' => ['required', 'string', 'max:255', 'unique:clubs,club_name'],
            'club_photo' => ['required', 'file', 'image', 'max:5120'],
            'players' => ['required', 'array', 'min:2'],
            'players.*.full_name' => ['required', 'string', 'max:255'],
            'players.*.student_staff_id' => ['required', 'string', 'max:100', 'distinct', 'unique:players,student_staff_id'],
            'players.*.jersey_number' => ['nullable', 'integer', 'min:0', 'max:99999'],
            'players.*.position' => ['nullable', 'string', 'max:100'],
            'players.*.role' => ['required', 'string', 'in:'.implode(',', self::PLAYER_ROLES)],
            'players.*.player_photo' => ['nullable', 'file', 'image', 'max:5120'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $players = $this->input('players', []);
            if (!is_array($players) || count($players) === 0) {
                return;
            }

            $leagueId = $this->integer('league_id');
            if ($leagueId > 0) {
                $isActive = \App\Models\League::query()
                    ->whereKey($leagueId)
                    ->where('status', 'active')
                    ->exists();

                if (!$isActive) {
                    $validator->errors()->add('league_id', 'Selected season must be active.');
                }
            }

            $roles = array_map(
                static fn ($p): string => is_array($p) && isset($p['role']) ? (string) $p['role'] : '',
                $players
            );

            $headCoachCount = count(array_filter($roles, static fn (string $r): bool => $r === 'Head Coach'));
            $captainCount = count(array_filter($roles, static fn (string $r): bool => $r === 'Captain'));

            if ($headCoachCount !== 1) {
                $validator->errors()->add('players', 'Each team must have exactly one Head Coach.');
            }
            if ($captainCount !== 1) {
                $validator->errors()->add('players', 'Each team must have exactly one Captain.');
            }
        });
    }
}
