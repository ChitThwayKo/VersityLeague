<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccessToken;
use App\Models\User;
use App\Services\RecaptchaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function __construct(
        protected RecaptchaService $recaptcha
    ) {}

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9._-]+$/', 'unique:users,username'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'recaptcha_token' => ['required', 'string'],
        ]);

        if (! $this->recaptcha->verify($validated['recaptcha_token'])) {
            return response()->json(['message' => 'reCAPTCHA verification failed.'], 422);
        }

        $user = User::query()->create([
            'username' => $validated['username'],
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role' => User::ROLE_CLIENT,
        ]);

        return response()->json($this->issueTokenResponse($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string'],
            'intent' => ['required', 'string', 'in:client,admin'],
            'recaptcha_token' => ['required', 'string'],
        ]);

        if (! $this->recaptcha->verify($validated['recaptcha_token'])) {
            return response()->json(['message' => 'reCAPTCHA verification failed.'], 422);
        }

        $user = User::query()->where('username', $validated['username'])->first();
        if ($user === null || ! Hash::check($validated['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        if ($validated['intent'] === 'client' && $user->role !== User::ROLE_CLIENT) {
            return response()->json(['message' => 'Use the admin sign-in for this account.'], 403);
        }

        if ($validated['intent'] === 'admin' && ! in_array($user->role, [User::ROLE_ADMIN, User::ROLE_MAIN_ADMIN], true)) {
            return response()->json(['message' => 'Use the student sign-in for this account.'], 403);
        }

        return response()->json($this->issueTokenResponse($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        if ($token !== null && $token !== '') {
            AccessToken::query()->where('token_hash', hash('sha256', $token))->delete();
        }

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['user' => $this->userPayload($user)]);
    }

    /**
     * @return array{user: array<string, mixed>, token: string, token_type: string}
     */
    protected function issueTokenResponse(User $user): array
    {
        $plain = Str::random(48);
        AccessToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'name' => 'auth',
        ]);

        return [
            'user' => $this->userPayload($user),
            'token' => $plain,
            'token_type' => 'Bearer',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ];
    }
}
