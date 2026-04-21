<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Club extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'name',
        'logo_path',
        'founded_year',
        'motto',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'founded_year' => 'integer',
        ];
    }

    public function members(): HasMany
    {
        return $this->hasMany(ClubMember::class);
    }

    public function logoPublicUrl(): ?string
    {
        if ($this->logo_path === null || $this->logo_path === '') {
            return null;
        }

        return Storage::disk('public')->url($this->logo_path);
    }
}
