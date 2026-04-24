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

    /**
     * Display name for certificate UI/PDF: staff id on the certificate first (authoritative),
     * then linked user (legacy rows may point at a placeholder account).
     */
    public function recipientDisplayName(): string
    {
        $ssid = trim((string) ($this->student_staff_id ?? ''));
        if ($ssid !== '') {
            $byUser = User::query()
                ->whereRaw('TRIM(COALESCE(student_staff_id, \'\')) = ?', [$ssid])
                ->value('name');
            if ($byUser) {
                return (string) $byUser;
            }
            $byPlayer = Player::query()
                ->whereRaw('TRIM(COALESCE(student_staff_id, \'\')) = ?', [$ssid])
                ->value('full_name');
            if ($byPlayer) {
                return (string) $byPlayer;
            }
        }

        $this->loadMissing('user');
        if ($this->user && filled($this->user->name)) {
            return (string) $this->user->name;
        }

        return 'Participant';
    }

    /**
     * Positions line: stored positions_played, else player.position for this staff id.
     */
    public function positionsDisplay(): string
    {
        if (filled($this->positions_played)) {
            return (string) $this->positions_played;
        }

        $ssid = trim((string) ($this->student_staff_id ?? ''));
        if ($ssid === '') {
            return '—';
        }

        $pos = Player::query()
            ->whereRaw('TRIM(COALESCE(student_staff_id, \'\')) = ?', [$ssid])
            ->value('position');

        return $pos ? (string) $pos : '—';
    }
}
