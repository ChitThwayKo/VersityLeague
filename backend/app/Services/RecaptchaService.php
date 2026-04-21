<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class RecaptchaService
{
    public function verify(?string $response): bool
    {
        if (config('services.recaptcha.skip_verify')) {
            return true;
        }

        $secret = config('services.recaptcha.secret');
        if ($secret === null || $secret === '') {
            return false;
        }

        if ($response === null || $response === '') {
            return false;
        }

        $result = Http::asForm()->post('https://www.google.com/recaptcha/api/siteverify', [
            'secret' => $secret,
            'response' => $response,
            'remoteip' => request()->ip(),
        ]);

        if (! $result->successful()) {
            return false;
        }

        return (bool) ($result->json('success') ?? false);
    }
}
