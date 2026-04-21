<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Season extends Model
{
    protected $fillable = [
        'label',
        'registration_opens_at',
        'registration_closes_at',
        'started_at',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'registration_opens_at' => 'datetime',
            'registration_closes_at' => 'datetime',
            'started_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function fixtures(): HasMany
    {
        return $this->hasMany(Fixture::class);
    }
}
