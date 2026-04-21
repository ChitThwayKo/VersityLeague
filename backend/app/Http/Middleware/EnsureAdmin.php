<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null || ! in_array($user->role, [User::ROLE_ADMIN, User::ROLE_MAIN_ADMIN], true)) {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        return $next($request);
    }
}
