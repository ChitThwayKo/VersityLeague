<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) (env('FRONTEND_ORIGINS') ?: '*'))
    ))) ?: ['*'],

    /*
    | Loopback with any port — avoids "Failed to fetch" when the frontend runs on
    | e.g. Live Server (5500) while FRONTEND_ORIGINS only lists another port.
    | Does not apply to public hostnames (production frontends still use FRONTEND_ORIGINS).
    */
    'allowed_origins_patterns' => [
        '#\Ahttps?://(localhost|127\.0\.0\.1)(:\d+)?\z#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
