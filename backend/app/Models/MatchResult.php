<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchResult extends Model
{
    protected $fillable = [
        'fixture_id',
        'home_goals',
        'away_goals',
    ];

    protected function casts(): array
    {
        return [
            'home_goals' => 'integer',
            'away_goals' => 'integer',
        ];
    }

    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }
}
