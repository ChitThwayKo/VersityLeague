<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreAdminPlayerRequest extends FormRequest
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
            'full_name' => ['required', 'string', 'max:255'],
            'student_staff_id' => ['required', 'string', 'max:100', 'unique:players,student_staff_id'],
            'jersey_number' => ['nullable', 'integer', 'min:0', 'max:99999'],
            'position' => ['required', 'string', 'max:100'],
            'player_photo' => ['nullable', 'image', 'max:5120'],
        ];
    }
}
