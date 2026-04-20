<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Models\Club;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFixtureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $t = $this->input('match_time');
        if (is_string($t) && preg_match('/^\d{2}:\d{2}$/', $t)) {
            $this->merge(['match_time' => $t.':00']);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'league_id' => ['required', 'exists:leagues,id'],
            'home_club_id' => ['required', 'exists:clubs,id', 'different:away_club_id'],
            'away_club_id' => ['required', 'exists:clubs,id'],
            'match_date' => ['required', 'date'],
            'match_time' => ['required', 'date_format:H:i:s'],
            'venue' => ['required', 'string', 'max:255'],
            'home_score' => ['nullable', 'integer', 'min:0'],
            'away_score' => ['nullable', 'integer', 'min:0'],
            'status' => ['required', Rule::in(['upcoming', 'finished', 'postponed'])],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $leagueId = (int) $this->input('league_id');
            $homeId = (int) $this->input('home_club_id');
            $awayId = (int) $this->input('away_club_id');
            if (! $leagueId || ! $homeId || ! $awayId) {
                return;
            }
            $home = Club::query()->find($homeId);
            $away = Club::query()->find($awayId);
            if (! $home || ! $away) {
                return;
            }
            if ($home->status !== 'approved' || $away->status !== 'approved') {
                $validator->errors()->add('home_club_id', 'Both clubs must be approved before scheduling.');
            }
            if ($home->league_id !== $leagueId || $away->league_id !== $leagueId) {
                $validator->errors()->add('league_id', 'Both clubs must belong to this league.');
            }
        });
    }
}
