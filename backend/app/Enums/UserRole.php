<?php

namespace App\Enums;

enum UserRole: string
{
    case Client = 'client';
    case Admin = 'admin';
    case DefaultAdmin = 'default_admin';

    public function matchesLoginPortal(string $portal): bool
    {
        return match ($portal) {
            'client' => $this === self::Client,
            'admin' => $this === self::Admin || $this === self::DefaultAdmin,
            default => false,
        };
    }

    public function isDefaultAdmin(): bool
    {
        return $this === self::DefaultAdmin;
    }
}
