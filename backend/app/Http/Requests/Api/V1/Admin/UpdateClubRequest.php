<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClubRequest extends FormRequest
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
            'club_name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('clubs', 'club_name')->ignore($this->route('club')),
            ],
            'status' => ['sometimes', Rule::in(['pending', 'approved', 'rejected'])],
            'league_id' => [
                'nullable',
                'exists:leagues,id',
                Rule::requiredIf(fn () => $this->input('status') === 'approved'),
            ],
        ];
    }
}
