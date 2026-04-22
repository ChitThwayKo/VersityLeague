<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsClient
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->role !== UserRole::Client) {
            abort(Response::HTTP_FORBIDDEN, 'Only student and staff (client) accounts can register a club.');
        }

        return $next($request);
    }
}
