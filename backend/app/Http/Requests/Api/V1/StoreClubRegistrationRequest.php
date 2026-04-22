<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreClubRegistrationRequest extends FormRequest
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
            'club_name' => ['required', 'string', 'max:255', 'unique:clubs,club_name'],
            'club_photo' => ['required', 'file', 'image', 'max:5120'],
            'player_full_name' => ['required', 'string', 'max:255'],
            'player_student_staff_id' => ['required', 'string', 'max:100', 'unique:players,student_staff_id'],
            'jersey_number' => ['nullable', 'integer', 'min:0', 'max:99999'],
            'position' => ['required', 'string', 'max:100'],
            'player_photo' => ['nullable', 'file', 'image', 'max:5120'],
        ];
    }
}
