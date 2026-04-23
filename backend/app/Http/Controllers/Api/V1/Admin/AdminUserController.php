<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreAdminUserRequest;
use App\Http\Requests\Api\V1\Admin\UpdateAdminUserRequest;
use App\Models\Club;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->orderBy('id')
            ->get(['id', 'name', 'email', 'student_staff_id', 'role', 'created_at']);

        $managedClubByUserId = Club::query()
            ->select(['manager_user_id', 'club_name'])
            ->whereNotNull('manager_user_id')
            ->get()
            ->keyBy('manager_user_id');

        $adminUsers = [];
        $clientUsers = [];
        foreach ($users as $user) {
            $row = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'student_staff_id' => $user->student_staff_id,
                'role' => $user->role->value,
                'created_at' => $user->created_at,
                'linked_club' => $managedClubByUserId->get($user->id)?->club_name,
            ];

            if ($user->role === UserRole::Client) {
                $clientUsers[] = $row;
            } else {
                $adminUsers[] = $row;
            }
        }

        return response()->json([
            'users' => $users->map(static fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'student_staff_id' => $user->student_staff_id,
                'role' => $user->role->value,
                'created_at' => $user->created_at,
            ]),
            'admin_users' => $adminUsers,
            'client_users' => $clientUsers,
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

    public function update(UpdateAdminUserRequest $request, User $user): JsonResponse
    {
        $payload = $request->safe()->except(['password', 'password_confirmation']);
        if ($request->filled('password')) {
            $payload['password'] = (string) $request->input('password');
        }

        $user->update($payload);
        $user->refresh();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'student_staff_id' => $user->student_staff_id,
                'role' => $user->role->value,
                'created_at' => $user->created_at,
            ],
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        if ($actor && $actor->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }
        if ($user->role === UserRole::DefaultAdmin) {
            return response()->json(['message' => 'Default admin account cannot be deleted.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}
