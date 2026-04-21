<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ClubMember extends Model
{
    public const TYPE_COACH = 'coach';

    public const TYPE_PLAYER = 'player';

    protected $fillable = [
        'club_id',
        'member_type',
        'name',
        'photo_path',
        'jersey_number',
        'position',
        'previous_achievements',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'jersey_number' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function club(): BelongsTo
    {
        return $this->belongsTo(Club::class);
    }

    public function photoPublicUrl(): ?string
    {
        if ($this->photo_path === null || $this->photo_path === '') {
            return null;
        }

        return Storage::disk('public')->url($this->photo_path);
    }
}
