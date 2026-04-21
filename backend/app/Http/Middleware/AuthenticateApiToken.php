<?php

namespace App\Http\Middleware;

use App\Models\AccessToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if ($token === null || $token === '') {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $hash = hash('sha256', $token);
        $record = AccessToken::query()->where('token_hash', $hash)->first();
        if ($record === null) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $user = $record->user;
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $record->forceFill(['last_used_at' => now()])->save();

        $request->setUserResolver(static fn () => $user);

        return $next($request);
    }
}
