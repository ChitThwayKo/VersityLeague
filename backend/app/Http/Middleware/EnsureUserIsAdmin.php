<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, [UserRole::Admin, UserRole::DefaultAdmin], true)) {
            abort(Response::HTTP_FORBIDDEN, 'Administrator access required.');
        }

        return $next($request);
    }
}
