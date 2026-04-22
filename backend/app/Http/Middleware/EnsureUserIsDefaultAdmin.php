<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsDefaultAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->role !== UserRole::DefaultAdmin) {
            abort(Response::HTTP_FORBIDDEN, 'Only the default administrator can perform this action.');
        }

        return $next($request);
    }
}
