<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreAdminUserRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class AdminUserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->orderBy('id')
            ->get(['id', 'name', 'email', 'student_staff_id', 'role', 'created_at']);

        return response()->json([
            'users' => $users->map(static fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'student_staff_id' => $user->student_staff_id,
                'role' => $user->role->value,
                'created_at' => $user->created_at,
            ]),
        ]);
    }

    public function store(StoreAdminUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'student_staff_id' => $data['student_staff_id'],
            'password' => $data['password'],
            'role' => UserRole::Admin,
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'student_staff_id' => $user->student_staff_id,
                'role' => $user->role->value,
            ],
        ], 201);
    }
}
