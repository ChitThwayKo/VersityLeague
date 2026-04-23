<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Models\League;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLeagueRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:255'],
            'year' => ['sometimes', 'string', 'max:100'],
            'starts_on' => ['sometimes', 'nullable', 'date'],
            'ends_on' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function (\Illuminate\Validation\Validator $validator): void {
            /** @var League|null $league */
            $league = $this->route('league');
            if (! $league instanceof League) {
                return;
            }

            $startsInput = $this->input('starts_on');
            $endsInput = $this->input('ends_on');
            if ($startsInput === null && $endsInput === null) {
                return;
            }

            $startStr = $startsInput !== null
                ? (string) $startsInput
                : ($league->starts_on?->format('Y-m-d') ?? '');
            $endStr = $endsInput !== null
                ? (string) $endsInput
                : ($league->ends_on?->format('Y-m-d') ?? '');

            if ($startStr !== '' && $endStr !== '' && $endStr < $startStr) {
                $validator->errors()->add('ends_on', 'The end date must be on or after the start date.');
            }
        });
    }
}
