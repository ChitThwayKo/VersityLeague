<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    protected $fillable = [
        'user_id',
        'club_id',
        'type',
        'title',
        'student_staff_id',
        'participate_year_start',
        'participate_year_end',
        'positions_played',
        'scored',
        'assisted',
        'file_path',
    ];

    protected function casts(): array
    {
        return [
            'participate_year_start' => 'integer',
            'participate_year_end' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function club(): BelongsTo
    {
        return $this->belongsTo(Club::class);
    }
}
