<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Club extends Model
{
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
}
