<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Player extends Model
{
    protected $fillable = [
        'club_id',
        'player_photo',
        'student_staff_id',
        'full_name',
        'jersey_number',
        'position',
        'role',
    ];

    public function club(): BelongsTo
    {
        return $this->belongsTo(Club::class);
    }

    public function fixtureStats(): HasMany
    {
        return $this->hasMany(FixturePlayerStat::class);
    }
}
