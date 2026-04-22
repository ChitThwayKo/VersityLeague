<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAdminPlayerRequest extends FormRequest
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
            'full_name' => ['sometimes', 'string', 'max:255'],
            'student_staff_id' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('players', 'student_staff_id')->ignore($this->route('player')),
            ],
            'jersey_number' => ['nullable', 'integer', 'min:0', 'max:99999'],
            'position' => ['sometimes', 'string', 'max:100'],
            'player_photo' => ['nullable', 'image', 'max:5120'],
        ];
    }
}
