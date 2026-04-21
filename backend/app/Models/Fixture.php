<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Fixture extends Model
{
    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_POSTPONED = 'postponed';

    protected $fillable = [
        'season_id',
        'match_number',
        'home_club_id',
        'away_club_id',
        'kickoff_at',
        'venue_name',
        'venue_location',
        'competition_name',
        'round_label',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'kickoff_at' => 'datetime',
        ];
    }

    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class);
    }

    public function homeClub(): BelongsTo
    {
        return $this->belongsTo(Club::class, 'home_club_id');
    }

    public function awayClub(): BelongsTo
    {
        return $this->belongsTo(Club::class, 'away_club_id');
    }

    public function result(): HasOne
    {
        return $this->hasOne(MatchResult::class);
    }
}
