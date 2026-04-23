<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Models\Fixture;
use App\Models\Player;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFixturePlayerStatRequest extends FormRequest
{
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
            'player_id' => ['required', 'exists:players,id'],
            'stat_type' => ['required', Rule::in(['participant', 'goal', 'assist'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var Fixture|null $fixture */
            $fixture = $this->route('fixture');
            if (! $fixture) {
                return;
            }

            $playerId = (int) $this->input('player_id');
            if (! $playerId) {
                return;
            }

            /** @var Player|null $player */
            $player = Player::query()->find($playerId);
            if (! $player) {
                return;
            }

            $allowedClubIds = [(int) $fixture->home_club_id, (int) $fixture->away_club_id];
            if (! in_array((int) $player->club_id, $allowedClubIds, true)) {
                $validator->errors()->add('player_id', 'Player must belong to one of the fixture clubs.');
            }
        });
    }
}
